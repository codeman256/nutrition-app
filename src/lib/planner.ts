/**
 * Planner engine — pure functions, no database access.
 *
 * Converts label amounts to canonical units, computes the nutrient × product
 * contribution matrix for one weekday of a weekly regimen, and grades totals
 * against the profile's RDA/AI and UL.
 */

import {
  NUTRIENT_BY_ID,
  NUTRIENTS,
  type NutrientDef,
} from "@/data/nutrients";
import { getDri, type DriQuery } from "@/data/dri";

export type { DriQuery } from "@/data/dri";

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

export type ParsedUnit = "mcg" | "mg" | "g" | "IU";

/** Normalize the many ways labels spell units; null when unrecognized. */
export function parseUnit(raw: string): ParsedUnit | null {
  const u = raw.trim().toLowerCase();
  // Health Canada's API spells units out ("micrograms"), while labels/DSLD use
  // abbreviations ("mcg"). Accept both, singular and plural.
  if (
    u === "mcg" ||
    u === "µg" ||
    u === "ug" ||
    u === "mkg" ||
    u === "microgram" ||
    u === "micrograms"
  )
    return "mcg";
  if (u === "mg" || u === "milligram" || u === "milligrams") return "mg";
  if (u === "g" || u === "gram" || u === "grams") return "g";
  if (
    u === "iu" ||
    u === "i.u." ||
    u === "ui" ||
    u === "international unit" ||
    u === "international units"
  )
    return "IU";
  return null;
}

const MASS_IN_MCG: Record<Exclude<ParsedUnit, "IU">, number> = {
  mcg: 1,
  mg: 1_000,
  g: 1_000_000,
};

/**
 * Convert an amount printed on a label into the nutrient's canonical unit.
 * Returns null when the conversion is impossible (unknown unit, or IU for a
 * nutrient without IU factors).
 */
export function toCanonicalAmount(
  nutrient: NutrientDef,
  amount: number,
  rawUnit: string,
  form?: string | null,
): number | null {
  const unit = parseUnit(rawUnit);
  if (unit === null || !Number.isFinite(amount) || amount < 0) return null;

  if (unit === "IU") {
    const factors = nutrient.iuFactors;
    if (!factors) return null;
    const factor = (form && factors[form.toLowerCase()]) || factors.default;
    // IU factors are expressed in the canonical unit already
    return amount * factor;
  }

  const inMcg = amount * MASS_IN_MCG[unit];
  const canonical = inMcg / MASS_IN_MCG[nutrient.unit];
  // apply a form multiplier for mass units too (e.g. mcg β-carotene → mcg RAE)
  const massFactors = nutrient.massFormFactors;
  if (massFactors) {
    const keyed = form ? massFactors[form.toLowerCase()] : undefined;
    const factor = keyed ?? massFactors.default ?? 1;
    return canonical * factor;
  }
  return canonical;
}

/* ------------------------------------------------------------------ */
/* Weekly schedule                                                     */
/* ------------------------------------------------------------------ */

/** Weekday index used across the app: 0 = Monday … 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const EVERY_DAY = 0b1111111;

export function isActiveOnDay(daysOfWeek: number, day: Weekday): boolean {
  return ((daysOfWeek >> day) & 1) === 1;
}

export function activeDayCount(daysOfWeek: number): number {
  let count = 0;
  for (let d = 0; d < 7; d++) if ((daysOfWeek >> d) & 1) count++;
  return count;
}

/** JS Date.getDay() (0=Sunday) → our Monday-first index. */
export function weekdayFromDate(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

/* ------------------------------------------------------------------ */
/* Matrix computation                                                  */
/* ------------------------------------------------------------------ */

export interface IngredientInput {
  nutrientId: string | null;
  amountPerServing: number;
  unit: string;
  form?: string | null;
}

export interface ProductInput {
  id: number;
  name: string;
  ingredients: IngredientInput[];
}

export interface RegimenItemInput {
  productId: number;
  servingsPerDay: number;
  daysOfWeek: number;
}

export type NutrientStatus =
  | "below-rda"
  | "meets-rda"
  | "near-ul"
  | "over-ul";

export interface NutrientRow {
  nutrient: NutrientDef;
  /** productId → amount contributed per day (canonical unit) */
  contributions: Record<number, number>;
  total: number;
  recommended: number | null;
  isAI: boolean;
  ul: number | null;
  pctRecommended: number | null;
  pctUl: number | null;
  status: NutrientStatus;
}

export interface DayPlan {
  day: Weekday;
  /** products active on this day, in input order */
  products: ProductInput[];
  rows: NutrientRow[];
  overUl: NutrientRow[];
}

function statusFor(
  total: number,
  recommended: number | null,
  ul: number | null,
): NutrientStatus {
  if (ul !== null && total > ul) return "over-ul";
  if (ul !== null && total >= 0.8 * ul) return "near-ul";
  if (recommended !== null && total >= recommended) return "meets-rda";
  return "below-rda";
}

/**
 * Compute one weekday's nutrient totals for a regimen.
 * Rows appear only for nutrients contributed by at least one active product,
 * sorted by the dictionary's display order.
 */
export function computeDay(
  products: ProductInput[],
  regimen: RegimenItemInput[],
  day: Weekday,
  profile: DriQuery,
): DayPlan {
  const productById = new Map(products.map((p) => [p.id, p]));
  const active: { product: ProductInput; servings: number }[] = [];

  for (const item of regimen) {
    if (!isActiveOnDay(item.daysOfWeek, day)) continue;
    const product = productById.get(item.productId);
    if (!product || item.servingsPerDay <= 0) continue;
    active.push({ product, servings: item.servingsPerDay });
  }

  const contributions = new Map<string, Record<number, number>>();
  for (const { product, servings } of active) {
    for (const ing of product.ingredients) {
      if (!ing.nutrientId) continue;
      const nutrient = NUTRIENT_BY_ID.get(ing.nutrientId);
      if (!nutrient) continue;
      const canonical = toCanonicalAmount(
        nutrient,
        ing.amountPerServing,
        ing.unit,
        ing.form,
      );
      if (canonical === null) continue;
      const byProduct = contributions.get(nutrient.id) ?? {};
      byProduct[product.id] = (byProduct[product.id] ?? 0) + canonical * servings;
      contributions.set(nutrient.id, byProduct);
    }
  }

  const rows: NutrientRow[] = [];
  for (const nutrient of NUTRIENTS) {
    const byProduct = contributions.get(nutrient.id);
    if (!byProduct) continue;
    const total = Object.values(byProduct).reduce((a, b) => a + b, 0);
    if (total <= 0) continue;

    const dri = getDri(nutrient.id, profile);
    rows.push({
      nutrient,
      contributions: byProduct,
      total,
      recommended: dri.recommended,
      isAI: dri.isAI,
      ul: dri.ul,
      pctRecommended:
        dri.recommended !== null ? (total / dri.recommended) * 100 : null,
      pctUl: dri.ul !== null ? (total / dri.ul) * 100 : null,
      status: statusFor(total, dri.recommended, dri.ul),
    });
  }

  return {
    day,
    products: active.map((a) => a.product),
    rows,
    overUl: rows.filter((r) => r.status === "over-ul"),
  };
}

/** Compute all seven days at once (dashboard week view). */
export function computeWeek(
  products: ProductInput[],
  regimen: RegimenItemInput[],
  profile: DriQuery,
): DayPlan[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((day) =>
    computeDay(products, regimen, day, profile),
  );
}

/* ------------------------------------------------------------------ */
/* What-if                                                             */
/* ------------------------------------------------------------------ */

export interface WhatIfResult {
  before: DayPlan;
  after: DayPlan;
  /** nutrients pushed over their UL by the candidate product */
  newlyOverUl: NutrientRow[];
}

/**
 * "What happens if I add this product every day?" — compares the given
 * weekday with and without the candidate.
 */
export function whatIf(
  products: ProductInput[],
  regimen: RegimenItemInput[],
  candidate: ProductInput,
  candidateServings: number,
  day: Weekday,
  profile: DriQuery,
): WhatIfResult {
  const before = computeDay(products, regimen, day, profile);
  const after = computeDay(
    [...products.filter((p) => p.id !== candidate.id), candidate],
    [
      ...regimen.filter((r) => r.productId !== candidate.id),
      {
        productId: candidate.id,
        servingsPerDay: candidateServings,
        daysOfWeek: EVERY_DAY,
      },
    ],
    day,
    profile,
  );

  const beforeOver = new Set(before.overUl.map((r) => r.nutrient.id));
  return {
    before,
    after,
    newlyOverUl: after.overUl.filter((r) => !beforeOver.has(r.nutrient.id)),
  };
}
