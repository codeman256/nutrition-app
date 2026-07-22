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

function matchUnitToken(u: string): ParsedUnit | null {
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

/** Normalize the many ways labels spell units; null when unrecognized. */
export function parseUnit(raw: string): ParsedUnit | null {
  const u = raw.trim().toLowerCase();
  const direct = matchUnitToken(u);
  if (direct) return direct;
  // Labels append a reference qualifier to the unit — "mcg RAE/EAR", "mg AT",
  // "µg RE" — and Health Canada carries it into the API's unit field. Fall back
  // to the leading mass/IU token so "mcg RAE" parses as mcg rather than blank.
  const lead = u.split(/[\s/]+/)[0];
  return lead === u ? null : matchUnitToken(lead);
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

/**
 * IU equivalent of a mass amount, for the nutrients that labels still print in
 * IU (vitamins A, D, E, and β-carotene as a vitamin-A form). Lets the product
 * form echo "≈ 1,000 IU" back to the user so they can confirm a row matches the
 * IU on their bottle. Returns null when the row isn't a mass amount of an
 * IU-labelled nutrient — e.g. the amount is already entered in IU.
 *
 * The canonical conversion already folds in the mass→form factor (β-carotene
 * ×0.5), and iuFactors are expressed per canonical unit, so dividing the
 * canonical amount by the form's IU factor reproduces the label's IU figure.
 */
export function iuEquivalent(
  nutrient: NutrientDef,
  amount: number,
  rawUnit: string,
  form?: string | null,
): number | null {
  const factors = nutrient.iuFactors;
  if (!factors || parseUnit(rawUnit) === "IU") return null;
  const canonical = toCanonicalAmount(nutrient, amount, rawUnit, form);
  if (canonical === null || canonical <= 0) return null;
  const factor = (form && factors[form.toLowerCase()]) || factors.default;
  if (!factor) return null;
  return canonical / factor;
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

/** One form's share of a nutrient's total, for the dashboard's sub-rows. */
export interface NutrientFormContribution {
  /** the ingredient form (a `nutrient.forms` value), or null when unspecified */
  form: string | null;
  /** productId → amount from this form per day (canonical unit) */
  contributions: Record<number, number>;
  total: number;
}

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
  /**
   * Split of the total by ingredient form, for nutrients that define forms
   * (vitamins A and E). Present whenever any form contributes; the dashboard
   * only draws sub-rows when two or more forms are involved (e.g. retinyl +
   * beta-carotene). Ordered by the nutrient's declared form order, unknown last.
   */
  formBreakdown?: NutrientFormContribution[];
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
 * Turn a nutrient's per-form, per-product amounts into ordered breakdown rows.
 * Drops forms that net to nothing; orders by the nutrient's declared form order
 * (unknown/unspecified last). Returns undefined when nothing contributes.
 */
function buildFormBreakdown(
  nutrient: NutrientDef,
  byForm: Map<string, Record<number, number>>,
): NutrientFormContribution[] | undefined {
  const entries: NutrientFormContribution[] = [];
  for (const [formKey, contributions] of byForm) {
    const total = Object.values(contributions).reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    entries.push({ form: formKey || null, contributions, total });
  }
  if (entries.length === 0) return undefined;

  const order = new Map((nutrient.forms ?? []).map((f, i) => [f.value, i]));
  const rank = (form: string | null) =>
    form === null ? 999 : order.get(form) ?? 998;
  entries.sort((a, b) => rank(a.form) - rank(b.form));
  return entries;
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
  // Parallel split by ingredient form, only kept for nutrients that define
  // forms (A/E) — feeds the dashboard's per-form sub-rows.
  const formContributions = new Map<string, Map<string, Record<number, number>>>();
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
      const amount = canonical * servings;
      const byProduct = contributions.get(nutrient.id) ?? {};
      byProduct[product.id] = (byProduct[product.id] ?? 0) + amount;
      contributions.set(nutrient.id, byProduct);

      if (nutrient.forms) {
        const formKey = ing.form ?? "";
        const byForm = formContributions.get(nutrient.id) ?? new Map();
        const byProductForm = byForm.get(formKey) ?? {};
        byProductForm[product.id] = (byProductForm[product.id] ?? 0) + amount;
        byForm.set(formKey, byProductForm);
        formContributions.set(nutrient.id, byForm);
      }
    }
  }

  const rows: NutrientRow[] = [];
  for (const nutrient of NUTRIENTS) {
    const byProduct = contributions.get(nutrient.id);
    if (!byProduct) continue;
    const total = Object.values(byProduct).reduce((a, b) => a + b, 0);
    if (total <= 0) continue;

    const dri = getDri(nutrient.id, profile);
    const byForm = formContributions.get(nutrient.id);
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
      formBreakdown: byForm ? buildFormBreakdown(nutrient, byForm) : undefined,
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

/**
 * Collapse a set of day-plans into a single "average per day" plan: sum each
 * nutrient's total (and per-product contribution) across the days and divide by
 * their count. A product taken only some days contributes 0 on the others, so a
 * 3-day-a-week supplement averages to 3/7 of its dose — this is the true
 * average daily intake, the number to compare against a daily RDA/UL.
 *
 * Rows and status are recomputed from the averaged total, so a nutrient can
 * read "over limit" on its heaviest day yet sit safely under it on average.
 */
function averagePlans(days: DayPlan[], profile: DriQuery): DayPlan {
  const divisor = days.length || 1;

  // Every product active on any day, in first-seen order, for the column set.
  const products: ProductInput[] = [];
  const seenProduct = new Set<number>();
  for (const d of days) {
    for (const p of d.products) {
      if (!seenProduct.has(p.id)) {
        seenProduct.add(p.id);
        products.push(p);
      }
    }
  }

  const summed = new Map<
    string,
    { total: number; contributions: Record<number, number> }
  >();
  // Sum each nutrient's form split across days too, so the averaged view keeps
  // its per-form sub-rows even when a form only appears on some days.
  const summedForms = new Map<string, Map<string, Record<number, number>>>();
  for (const d of days) {
    for (const row of d.rows) {
      const acc = summed.get(row.nutrient.id) ?? { total: 0, contributions: {} };
      acc.total += row.total;
      for (const [pid, amt] of Object.entries(row.contributions)) {
        acc.contributions[Number(pid)] = (acc.contributions[Number(pid)] ?? 0) + amt;
      }
      summed.set(row.nutrient.id, acc);

      if (row.formBreakdown) {
        const byForm = summedForms.get(row.nutrient.id) ?? new Map();
        for (const fc of row.formBreakdown) {
          const formKey = fc.form ?? "";
          const byProductForm = byForm.get(formKey) ?? {};
          for (const [pid, amt] of Object.entries(fc.contributions)) {
            byProductForm[Number(pid)] = (byProductForm[Number(pid)] ?? 0) + amt;
          }
          byForm.set(formKey, byProductForm);
        }
        summedForms.set(row.nutrient.id, byForm);
      }
    }
  }

  const rows: NutrientRow[] = [];
  for (const nutrient of NUTRIENTS) {
    const acc = summed.get(nutrient.id);
    if (!acc) continue;
    const total = acc.total / divisor;
    if (total <= 0) continue;

    const contributions: Record<number, number> = {};
    for (const [pid, amt] of Object.entries(acc.contributions)) {
      contributions[Number(pid)] = amt / divisor;
    }

    const byForm = summedForms.get(nutrient.id);
    let averagedForms: Map<string, Record<number, number>> | undefined;
    if (byForm) {
      averagedForms = new Map();
      for (const [formKey, byProductForm] of byForm) {
        const divided: Record<number, number> = {};
        for (const [pid, amt] of Object.entries(byProductForm)) {
          divided[Number(pid)] = amt / divisor;
        }
        averagedForms.set(formKey, divided);
      }
    }

    const dri = getDri(nutrient.id, profile);
    rows.push({
      nutrient,
      contributions,
      total,
      recommended: dri.recommended,
      isAI: dri.isAI,
      ul: dri.ul,
      pctRecommended:
        dri.recommended !== null ? (total / dri.recommended) * 100 : null,
      pctUl: dri.ul !== null ? (total / dri.ul) * 100 : null,
      status: statusFor(total, dri.recommended, dri.ul),
      formBreakdown: averagedForms
        ? buildFormBreakdown(nutrient, averagedForms)
        : undefined,
    });
  }

  return {
    // No single weekday owns an average; callers key the average view off their
    // own mode flag, not this field.
    day: 0 as Weekday,
    products,
    rows,
    overUl: rows.filter((r) => r.status === "over-ul"),
  };
}

/** Average daily intake across the week (each nutrient's weekly total ÷ 7). */
export function averageWeek(
  products: ProductInput[],
  regimen: RegimenItemInput[],
  profile: DriQuery,
): DayPlan {
  return averagePlans(computeWeek(products, regimen, profile), profile);
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

/**
 * Weekly-average counterpart of {@link whatIf}: adds the candidate every day and
 * compares averaged plans, so "what if I add this" answers hold up in the
 * average-per-day view too.
 */
export function whatIfAverage(
  products: ProductInput[],
  regimen: RegimenItemInput[],
  candidate: ProductInput,
  candidateServings: number,
  profile: DriQuery,
): WhatIfResult {
  const before = averageWeek(products, regimen, profile);
  const after = averageWeek(
    [...products.filter((p) => p.id !== candidate.id), candidate],
    [
      ...regimen.filter((r) => r.productId !== candidate.id),
      {
        productId: candidate.id,
        servingsPerDay: candidateServings,
        daysOfWeek: EVERY_DAY,
      },
    ],
    profile,
  );

  const beforeOver = new Set(before.overUl.map((r) => r.nutrient.id));
  return {
    before,
    after,
    newlyOverUl: after.overUl.filter((r) => !beforeOver.has(r.nutrient.id)),
  };
}
