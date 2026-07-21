/**
 * Health Canada Licensed Natural Health Products Database (LNHPD) client.
 *
 * The public API (https://health-products.canada.ca/api/documentation/lnhpd-documentation-en.html)
 * has no search parameters: endpoints return either one record by internal id
 * or the complete ~300k-row dump. So we download the product-licence dump once
 * (streamed, ~150 MB) into a local SQLite index and search that; per-product
 * ingredient details are fetched live by lnhpd_id (small responses).
 */

import { Readable } from "node:stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { and, getTableColumns, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { lnhpdIndex, lnhpdSyncState } from "@/db/schema";
import { guessForm, matchNutrient } from "@/data/nutrients";
import { parseUnit } from "@/lib/planner";
import type { IngredientDraft, ProductDraft, SearchHit } from "./types";

const BASE = "https://health-products.canada.ca/api/natural-licences";

/**
 * SQLite refuses a statement with more than SQLITE_MAX_VARIABLE_NUMBER bound
 * parameters (32,766) — "too many SQL variables". A multi-row insert binds one
 * parameter per column per row, so the batch size has to account for how wide
 * the table is. Derived from the actual column count rather than hard-coded,
 * so widening the table can't silently push us back over the cap.
 */
const SQLITE_MAX_VARIABLES = 32_766;
export const LNHPD_COLUMN_COUNT = Object.keys(getTableColumns(lnhpdIndex)).length;
export const LNHPD_INSERT_BATCH = Math.floor(
  (SQLITE_MAX_VARIABLES * 0.9) / LNHPD_COLUMN_COUNT,
);

/** One row of the product-licence dump — every field it gives us. */
interface LnhpdLicenceRecord {
  lnhpd_id?: number;
  product_name_id?: number;
  licence_number?: string;
  product_name?: string;
  company_name?: string;
  company_id?: number;
  company_name_id?: number;
  dosage_form?: string;
  licence_date?: string;
  revised_date?: string;
  time_receipt?: string;
  date_start?: string;
  sub_submission_type_code?: number;
  sub_submission_type_desc?: string;
  flag_primary_name?: number;
  flag_product_status?: number;
  flag_attested_monograph?: number;
}

export async function getLnhpdSyncState() {
  const rows = await db.select().from(lnhpdSyncState).limit(1);
  return rows[0] ?? null;
}

/**
 * Live row count, rather than the `record_count` written at the end of the last
 * sync. The two can disagree — a failed sync clears the table before inserting,
 * and the test suite wipes it to seed fixtures — and trusting the cached number
 * makes the UI claim a full index while search quietly returns nothing.
 */
export async function getLnhpdRowCount(): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)` }).from(lnhpdIndex);
  return rows[0]?.n ?? 0;
}

/** Persist how often the index should auto-refresh (days; 0 = never). */
export async function setLnhpdAutoSyncDays(days: number) {
  await db
    .insert(lnhpdSyncState)
    .values({ id: 1, autoSyncDays: days })
    .onConflictDoUpdate({
      target: lnhpdSyncState.id,
      set: { autoSyncDays: days },
    });
}

/* ------------------------------------------------------------------ */
/* Background sync job (single instance, in-process)                   */
/* ------------------------------------------------------------------ */

export interface LnhpdSyncProgress {
  running: boolean;
  /** rows ingested so far in the running/last job */
  count: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

// Survive dev hot reloads so a running job isn't orphaned.
const globalForSync = globalThis as unknown as { lnhpdSyncJob?: LnhpdSyncProgress };
const syncJob: LnhpdSyncProgress = (globalForSync.lnhpdSyncJob ??= {
  running: false,
  count: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
});

export function getLnhpdSyncProgress(): LnhpdSyncProgress {
  return { ...syncJob };
}

/**
 * Kick off a sync in the background if one isn't already running, and return
 * the current progress immediately. Callers poll {@link getLnhpdSyncProgress}.
 */
export function startLnhpdSync(): LnhpdSyncProgress {
  if (syncJob.running) return { ...syncJob };
  syncJob.running = true;
  syncJob.count = 0;
  syncJob.startedAt = Date.now();
  syncJob.finishedAt = null;
  syncJob.error = null;
  void syncLnhpdIndex((n) => {
    syncJob.count = n;
  })
    .then((r) => {
      syncJob.count = r.recordCount;
    })
    .catch((e: unknown) => {
      syncJob.error = e instanceof Error ? e.message : "unknown error";
      // The client only sees the message; keep the stack on the server so a
      // failed sync is actually diagnosable from the container logs.
      console.error("[vitaplan] LNHPD sync failed after", syncJob.count, "rows:", e);
    })
    .finally(() => {
      syncJob.running = false;
      syncJob.finishedAt = Date.now();
    });
  return { ...syncJob };
}

/** True when auto-sync is enabled and the index is older than the interval. */
export async function isLnhpdSyncDue(): Promise<boolean> {
  const state = await getLnhpdSyncState();
  const days = state?.autoSyncDays ?? 0;
  if (days <= 0) return false;
  if (!state?.syncedAt) return true;
  return Date.now() - state.syncedAt.getTime() >= days * 86_400_000;
}

/** Start a sync only if the schedule says one is due and none is running. */
export async function maybeAutoSyncLnhpd(): Promise<void> {
  if (syncJob.running) return;
  if (await isLnhpdSyncDue()) startLnhpdSync();
}

/**
 * Download the full product-licence dump and rebuild the local index.
 * Takes a few minutes on a typical connection; call from a route handler.
 * `onProgress` is invoked with the running row count as batches land.
 */
export async function syncLnhpdIndex(
  onProgress?: (count: number) => void,
): Promise<{ recordCount: number }> {
  const res = await fetch(`${BASE}/productlicence/?lang=en&type=json`, {
    // the dump is large and the server is slow to start streaming
    signal: AbortSignal.timeout(20 * 60_000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`LNHPD dump download failed (${res.status})`);
  }

  const pipeline = chain([
    Readable.fromWeb(res.body as import("stream/web").ReadableStream),
    parser(),
    streamArray(),
  ]);

  const batch: (typeof lnhpdIndex.$inferInsert)[] = [];
  let count = 0;
  let cleared = false;

  const flush = async () => {
    if (batch.length === 0) return;
    if (!cleared) {
      // only wipe the old index once the new download is actually producing rows
      await db.delete(lnhpdIndex);
      cleared = true;
    }
    // Chunked so a single statement never exceeds SQLite's parameter cap.
    const rows = batch.splice(0);
    for (let i = 0; i < rows.length; i += LNHPD_INSERT_BATCH) {
      await db
        .insert(lnhpdIndex)
        .values(rows.slice(i, i + LNHPD_INSERT_BATCH))
        .onConflictDoNothing();
    }
  };

  for await (const item of pipeline) {
    const record = (item as { value: LnhpdLicenceRecord }).value;
    if (
      !record.lnhpd_id ||
      !record.product_name_id ||
      !record.licence_number ||
      !record.product_name
    ) {
      continue;
    }
    // Every name is kept — a licence's flavour/alternate names are exactly what
    // people read off their bottle. Status and primary flags are stored rather
    // than filtered on, so search can rank and label them.
    batch.push({
      lnhpdId: record.lnhpd_id,
      productNameId: record.product_name_id,
      licenceNumber: record.licence_number,
      productName: record.product_name,
      companyName: record.company_name ?? null,
      companyId: record.company_id ?? null,
      companyNameId: record.company_name_id ?? null,
      dosageForm: record.dosage_form ?? null,
      licenceDate: record.licence_date ?? null,
      revisedDate: record.revised_date ?? null,
      timeReceipt: record.time_receipt ?? null,
      dateStart: record.date_start ?? null,
      subSubmissionTypeCode: record.sub_submission_type_code ?? null,
      subSubmissionTypeDesc: record.sub_submission_type_desc ?? null,
      flagPrimaryName: record.flag_primary_name ?? null,
      flagProductStatus: record.flag_product_status ?? null,
      flagAttestedMonograph: record.flag_attested_monograph ?? null,
    });
    count++;
    if (batch.length >= 2000) {
      await flush();
      onProgress?.(count);
    }
  }
  await flush();
  onProgress?.(count);

  // Report what actually landed, not what streamed past: a handful of rows
  // repeat the same (lnhpd_id, product_name_id) pair and are dropped.
  const stored = await db.select({ n: sql<number>`count(*)` }).from(lnhpdIndex);
  const recordCount = stored[0]?.n ?? count;

  await db
    .insert(lnhpdSyncState)
    .values({ id: 1, syncedAt: new Date(), recordCount })
    .onConflictDoUpdate({
      target: lnhpdSyncState.id,
      set: { syncedAt: new Date(), recordCount },
    });

  return { recordCount };
}

/**
 * Vitamin strengths get written both ways: the bottle says "B Complex 100"
 * while people search "B100", and "B12" appears as "Vitamin B 12". Split a
 * letter+digits term into its two halves so each can match separately —
 * otherwise "b100" is a literal substring that no Jamieson label contains.
 */
export function expandVitaminTerms(terms: string[]): string[] {
  const out: string[] = [];
  for (const term of terms) {
    const parts = /^([a-z])[-\s]?(\d+)$/.exec(term);
    if (parts) {
      out.push(parts[1], parts[2]);
    } else {
      out.push(term);
    }
  }
  return out;
}

/**
 * Order a licence's names for display: primary name first, then alphabetical.
 * Any name matching the user's search is hoisted to the front so the result
 * shows the wording they actually typed.
 */
export function nameScore(name: string, terms: string[]): number {
  const lower = name.toLowerCase();
  return terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
}

function orderNames(
  rows: (typeof lnhpdIndex.$inferSelect)[],
  terms: string[],
): string[] {
  const seen = new Set<string>();
  return rows
    .slice()
    .sort((a, b) => {
      // Lead with the name that explains the match. A licence can match on a
      // name other than its primary one ("Vitamin B2 100 mg" under a licence
      // whose primary name is just "Vitamin B2"), and showing the primary
      // there looks like a wrong result.
      const scored = nameScore(b.productName, terms) - nameScore(a.productName, terms);
      if (scored !== 0) return scored;
      const ap = a.flagPrimaryName === 1 ? 1 : 0;
      const bp = b.flagPrimaryName === 1 ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return a.productName.localeCompare(b.productName);
    })
    .map((r) => r.productName)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Search the local index by NPN licence number or product name.
 * Results are grouped by licence: a licence sold under several names is one
 * hit carrying all of them, so the user can pick the wording on their bottle.
 */
export async function searchLnhpd(query: string, limit = 12): Promise<SearchHit[]> {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  const isNpn = digits.length >= 6 && digits.length === trimmed.length;

  // every word must appear in the product name or the company name
  // ("jamieson vitamin d" → brand in company_name, rest in product_name)
  const terms = expandVitaminTerms(
    trimmed.toLowerCase().split(/\s+/).filter(Boolean),
  );

  // A one- or two-letter term has to start a word, so the "d" in "vitamin d"
  // matches "Vitamin D3" but not the "d" inside "Jamieson Laboratories Ltd.".
  // Longer terms stay plain substring matches.
  // Word-start applies only to short *letter* terms. A digit fragment split off
  // "b2" has to match inside a word, since that's exactly where it lives.
  const termMatches = (term: string) =>
    term.length <= 2 && /^[a-z]+$/.test(term)
      ? or(
          like(sql`' ' || lower(${lnhpdIndex.productName})`, `% ${term}%`),
          like(sql`' ' || lower(${lnhpdIndex.companyName})`, `% ${term}%`),
        )
      : or(
          like(sql`lower(${lnhpdIndex.productName})`, `%${term}%`),
          like(sql`lower(${lnhpdIndex.companyName})`, `%${term}%`),
        );

  const where = isNpn
    ? like(lnhpdIndex.licenceNumber, `${digits}%`)
    : and(...terms.map(termMatches));

  // Which licences matched — active ones first, so a cancelled licence never
  // crowds out a product still on the shelf.
  const matched = await db
    .select({ lnhpdId: lnhpdIndex.lnhpdId })
    .from(lnhpdIndex)
    .where(where)
    .groupBy(lnhpdIndex.lnhpdId)
    .orderBy(sql`max(${lnhpdIndex.flagProductStatus} = 1) desc`)
    .limit(limit);

  const ids = matched.map((m) => m.lnhpdId);
  if (ids.length === 0) return [];

  // Pull every name row for those licences, not just the ones that matched.
  const rows = await db
    .select()
    .from(lnhpdIndex)
    .where(inArray(lnhpdIndex.lnhpdId, ids));

  const byLicence = new Map<number, (typeof lnhpdIndex.$inferSelect)[]>();
  for (const row of rows) {
    const list = byLicence.get(row.lnhpdId) ?? [];
    list.push(row);
    byLicence.set(row.lnhpdId, list);
  }

  const hits = ids.flatMap((id) => {
    const group = byLicence.get(id);
    if (!group || group.length === 0) return [];
    const names = orderNames(group, terms);
    const head = group[0];
    const active = group.some((r) => r.flagProductStatus === 1);
    return [
      {
        hit: {
          source: "lnhpd" as const,
          sourceId: String(id),
          name: names[0] ?? head.productName,
          names,
          brand: head.companyName,
          npn: head.licenceNumber,
          discontinued: !active,
        },
        // best-matching name decides where the licence ranks
        score: nameScore(names[0] ?? "", terms),
        active,
      },
    ];
  });

  // Closest name match first, then products still on the market.
  hits.sort((a, b) => b.score - a.score || Number(b.active) - Number(a.active));
  return hits.map((h) => h.hit);
}

interface LnhpdIngredient {
  ingredient_name?: string;
  quantity?: number;
  quantity_unit_of_measure?: string;
  potency_amount?: number;
  potency_unit_of_measure?: string;
  /** e.g. "Menaquinones-7" for a Vitamin K2 row, "Cholecalciferol" for D */
  source_material?: string;
}

export async function getLnhpdProduct(lnhpdId: string): Promise<ProductDraft> {
  // All name rows for this licence, so the user can pick the one on their bottle.
  const indexRows = await db
    .select()
    .from(lnhpdIndex)
    .where(sql`${lnhpdIndex.lnhpdId} = ${Number(lnhpdId)}`);
  const nameOptions = orderNames(indexRows, []);
  const indexed = indexRows[0];

  const res = await fetch(
    `${BASE}/medicinalingredient/?lang=en&type=json&id=${encodeURIComponent(lnhpdId)}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) throw new Error(`LNHPD ingredient fetch failed (${res.status})`);
  const body = (await res.json()) as { data?: LnhpdIngredient[] };

  const ingredients: IngredientDraft[] = [];
  const seen = new Set<string>();
  for (const ing of body.data ?? []) {
    const name = ing.ingredient_name?.trim();
    if (!name) continue;

    // Keep every medicinal ingredient. Prefer the labelled quantity; fall back
    // to the potency amount. Health Canada spells units out ("micrograms"), so
    // normalise; if the unit isn't a mass/IU we understand (enzyme activity
    // units, etc.), keep the ingredient but leave the unit blank.
    let amount = typeof ing.quantity === "number" && ing.quantity > 0 ? ing.quantity : 0;
    let unit = parseUnit(ing.quantity_unit_of_measure ?? "") ?? "";
    if (amount === 0 && typeof ing.potency_amount === "number" && ing.potency_amount > 0) {
      amount = ing.potency_amount;
      unit = parseUnit(ing.potency_unit_of_measure ?? "") ?? "";
    }

    // The source material disambiguates a generic name: "Vitamin K2
    // (Menaquinones-7)", "Vitamin D (Cholecalciferol)".
    const source = ing.source_material?.trim();
    const label =
      source && !name.toLowerCase().includes(source.toLowerCase())
        ? `${name} (${source})`
        : name;

    // the API repeats an ingredient once per potency constituent
    const key = `${label.toLowerCase()}|${amount}|${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    ingredients.push({
      label,
      nutrientId: matchNutrient(name)?.id ?? null,
      amountPerServing: amount,
      unit,
      form: guessForm(source ?? "") ?? guessForm(name) ?? null,
    });
  }

  return {
    name: nameOptions[0] ?? indexed?.productName ?? `LNHPD ${lnhpdId}`,
    nameOptions,
    brand: indexed?.companyName ?? null,
    npn: indexed?.licenceNumber ?? null,
    servingSize: indexed?.dosageForm ? `1 ${indexed.dosageForm}` : null,
    source: "lnhpd",
    ingredients,
  };
}
