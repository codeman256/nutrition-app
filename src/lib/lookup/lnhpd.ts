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
import { and, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { lnhpdIndex, lnhpdSyncState } from "@/db/schema";
import { matchNutrient } from "@/data/nutrients";
import { parseUnit } from "@/lib/planner";
import type { IngredientDraft, ProductDraft, SearchHit } from "./types";

const BASE = "https://health-products.canada.ca/api/natural-licences";

interface LnhpdLicenceRecord {
  lnhpd_id?: number;
  licence_number?: string;
  product_name?: string;
  company_name?: string;
  dosage_form?: string;
  flag_primary_name?: number;
  flag_product_status?: number;
}

export async function getLnhpdSyncState() {
  const rows = await db.select().from(lnhpdSyncState).limit(1);
  return rows[0] ?? null;
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
    await db.insert(lnhpdIndex).values(batch.splice(0)).onConflictDoNothing();
  };

  for await (const item of pipeline) {
    const record = (item as { value: LnhpdLicenceRecord }).value;
    if (!record.lnhpd_id || !record.licence_number || !record.product_name) continue;
    // keep only primary names of active licences to avoid duplicate rows
    if (record.flag_primary_name === 0 && record.flag_product_status !== 1) continue;
    batch.push({
      lnhpdId: record.lnhpd_id,
      licenceNumber: record.licence_number,
      productName: record.product_name,
      companyName: record.company_name ?? null,
      dosageForm: record.dosage_form ?? null,
    });
    count++;
    if (batch.length >= 2000) {
      await flush();
      onProgress?.(count);
    }
  }
  await flush();
  onProgress?.(count);

  await db
    .insert(lnhpdSyncState)
    .values({ id: 1, syncedAt: new Date(), recordCount: count })
    .onConflictDoUpdate({
      target: lnhpdSyncState.id,
      set: { syncedAt: new Date(), recordCount: count },
    });

  return { recordCount: count };
}

/** Search the local index by NPN licence number or product name. */
export async function searchLnhpd(query: string, limit = 12): Promise<SearchHit[]> {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  const isNpn = digits.length >= 6 && digits.length === trimmed.length;

  // every word must appear in the product name or the company name
  // ("jamieson vitamin d" → brand in company_name, rest in product_name)
  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = await db
    .select()
    .from(lnhpdIndex)
    .where(
      isNpn
        ? like(lnhpdIndex.licenceNumber, `${digits}%`)
        : and(
            ...terms.map((term) =>
              or(
                like(sql`lower(${lnhpdIndex.productName})`, `%${term}%`),
                like(sql`lower(${lnhpdIndex.companyName})`, `%${term}%`),
              ),
            ),
          ),
    )
    .limit(limit);

  return rows.map((row) => ({
    source: "lnhpd",
    sourceId: String(row.lnhpdId),
    name: row.productName,
    brand: row.companyName,
    npn: row.licenceNumber,
  }));
}

interface LnhpdIngredient {
  ingredient_name?: string;
  quantity?: number;
  quantity_unit_of_measure?: string;
}

export async function getLnhpdProduct(lnhpdId: string): Promise<ProductDraft> {
  const indexRows = await db
    .select()
    .from(lnhpdIndex)
    .where(sql`${lnhpdIndex.lnhpdId} = ${Number(lnhpdId)}`)
    .limit(1);
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
    const name = ing.ingredient_name ?? "";
    if (!name || typeof ing.quantity !== "number" || ing.quantity <= 0) continue;
    const unit = ing.quantity_unit_of_measure ?? "";
    if (parseUnit(unit) === null) continue;
    // the API repeats an ingredient once per potency constituent
    const key = `${name.toLowerCase()}|${ing.quantity}|${unit.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ingredients.push({
      label: name,
      nutrientId: matchNutrient(name)?.id ?? null,
      amountPerServing: ing.quantity,
      unit,
      form: null,
    });
  }

  return {
    name: indexed?.productName ?? `LNHPD ${lnhpdId}`,
    brand: indexed?.companyName ?? null,
    npn: indexed?.licenceNumber ?? null,
    servingSize: indexed?.dosageForm ? `1 ${indexed.dosageForm}` : null,
    source: "lnhpd",
    ingredients,
  };
}
