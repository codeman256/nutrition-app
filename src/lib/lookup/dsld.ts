/**
 * NIH Dietary Supplement Label Database (DSLD) client.
 * Docs: https://dsld.od.nih.gov/api-guide — free, no API key.
 */

import { guessForm, matchNutrient } from "@/data/nutrients";
import { parseUnit } from "@/lib/planner";
import type { IngredientDraft, ProductDraft, SearchHit } from "./types";

const BASE = "https://api.ods.od.nih.gov/dsld/v9";

/** DSLD stores UPC-A as "0 27917 02152 2" — reformat plain digits to match. */
export function formatUpcForDsld(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 12) {
    return `${digits[0]} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits[11]}`;
  }
  if (digits.length === 13 && digits.startsWith("0")) {
    // EAN-13 with leading zero is a UPC-A underneath
    return formatUpcForDsld(digits.slice(1));
  }
  return digits;
}

interface DsldHit {
  _id: string;
  _source: {
    fullName?: string;
    brandName?: string;
    // Search results almost never carry the UPC (it's on the full label), but
    // keep reading it for the rare hit that does.
    upcSku?: string;
    offMarket?: number;
    netContents?: { display?: string; quantity?: number; unit?: string }[];
    productType?: { langualCodeDescription?: string };
    physicalState?: { langualCodeDescription?: string };
  };
}

export async function searchDsld(query: string, size = 12): Promise<SearchHit[]> {
  const url = `${BASE}/search-filter?q=${encodeURIComponent(query)}&size=${size}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`DSLD search failed (${res.status})`);
  const body = (await res.json()) as { hits?: DsldHit[] };
  // DSLD lists many near-identical products (several "Centrum Specialist
  // Energy" rows). Surface what tells them apart: count/form, category, and
  // whether the product is still on the market. The DSLD id (sourceId) is a
  // unique tiebreaker shown in the UI when two rows read the same.
  return (body.hits ?? []).map((hit) => {
    const s = hit._source;
    return {
      source: "dsld",
      sourceId: hit._id,
      name: s.fullName ?? "Unknown product",
      brand: s.brandName ?? null,
      upc: s.upcSku?.replace(/\D/g, "") || null,
      netContents: s.netContents?.find((n) => n.display)?.display ?? null,
      productType: s.productType?.langualCodeDescription ?? null,
      form: s.physicalState?.langualCodeDescription ?? null,
      discontinued: s.offMarket === 1,
    };
  });
}

export async function searchDsldByUpc(code: string): Promise<SearchHit[]> {
  const formatted = formatUpcForDsld(code);
  return searchDsld(`"${formatted}"`, 3);
}

interface DsldServingSize {
  order?: number;
  minQuantity?: number;
  unit?: string;
}

interface DsldQuantity {
  quantity?: number;
  unit?: string;
  servingSizeOrder?: number;
  /** the serving amount this figure is stated for (e.g. 22.5 g vs 45 g) */
  servingSizeQuantity?: number;
}

interface DsldLabel {
  fullName?: string;
  brandName?: string;
  upcSku?: string;
  thumbnail?: string;
  servingsPerContainer?: number | string;
  servingSizes?: DsldServingSize[];
  ingredientRows?: {
    name?: string;
    forms?: { name?: string }[];
    quantity?: DsldQuantity[];
  }[];
}

/**
 * A DSLD ingredient can list one amount per serving-size column (e.g. a
 * "1-2 scoops" panel gives the figure for 22.5 g and again for 45 g). Import a
 * single consistent serving — the base one — instead of blindly taking the
 * first entry, which isn't guaranteed to be that column.
 */
export function pickServingQuantity(
  quantities: DsldQuantity[] | undefined,
  base: DsldServingSize | undefined,
): DsldQuantity | undefined {
  if (!quantities || quantities.length === 0) return undefined;
  if (quantities.length === 1) return quantities[0];

  // Prefer entries for the base serving's column…
  const sameOrder =
    base?.order !== undefined
      ? quantities.filter((q) => q.servingSizeOrder === base.order)
      : [];
  const pool = sameOrder.length > 0 ? sameOrder : quantities;

  // …then the one stated for exactly the base serving amount…
  if (base?.minQuantity !== undefined) {
    const exact = pool.find((q) => q.servingSizeQuantity === base.minQuantity);
    if (exact) return exact;
  }

  // …otherwise the smallest serving (the base dose), not a random column.
  return [...pool].sort(
    (a, b) =>
      (a.servingSizeQuantity ?? Number.POSITIVE_INFINITY) -
      (b.servingSizeQuantity ?? Number.POSITIVE_INFINITY),
  )[0];
}

export async function getDsldProduct(labelId: string): Promise<ProductDraft> {
  const res = await fetch(`${BASE}/label/${encodeURIComponent(labelId)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`DSLD label fetch failed (${res.status})`);
  const label = (await res.json()) as DsldLabel;

  // The base serving is the lowest-order column; import every ingredient for it.
  const baseServing = [...(label.servingSizes ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )[0];

  const ingredients: IngredientDraft[] = [];
  for (const row of label.ingredientRows ?? []) {
    const name = row.name ?? "";
    if (!name) continue;
    const q = pickServingQuantity(row.quantity, baseServing);
    if (!q || typeof q.quantity !== "number" || !q.unit) continue;
    if (parseUnit(q.unit) === null) continue; // skips Calories, %, etc.
    const formNames = (row.forms ?? [])
      .map((f) => f.name ?? "")
      .filter(Boolean);
    const displayName =
      formNames.length > 0 ? `${name} (${formNames.join(", ")})` : name;
    ingredients.push({
      label: displayName,
      nutrientId: matchNutrient(displayName)?.id ?? null,
      amountPerServing: q.quantity,
      unit: q.unit,
      form: guessForm(displayName),
    });
  }

  const serving = baseServing;
  return {
    name: label.fullName ?? "Unknown product",
    brand: label.brandName ?? null,
    upc: label.upcSku?.replace(/\D/g, "") || null,
    servingSize: serving
      ? `${serving.minQuantity ?? 1} ${serving.unit ?? "serving"}`
      : null,
    servingsPerContainer: Number(label.servingsPerContainer) || null,
    imageUrl: label.thumbnail ?? null,
    source: "dsld",
    ingredients,
  };
}
