/**
 * Dashboard unit display modes.
 *
 * The planner works entirely in each nutrient's canonical unit. These helpers
 * only affect presentation: they scale absolute amounts into whichever unit the
 * user picked. Percentages are always derived from canonical values, so they
 * read the same in every mode.
 */

import type { NutrientDef } from "@/data/nutrients";

export type UnitMode = "label" | "mcg" | "mg" | "iu";

export const UNIT_MODES: { value: UnitMode; label: string }[] = [
  { value: "label", label: "As on the label" },
  { value: "mcg", label: "Everything in mcg" },
  { value: "mg", label: "Everything in mg" },
  { value: "iu", label: "IU where it applies" },
];

const MASS_IN_MCG: Record<string, number> = { g: 1_000_000, mg: 1_000, mcg: 1 };

export interface DisplayUnit {
  unit: string;
  /** multiply a canonical amount by this to get the displayed amount */
  factor: number;
}

export function displayUnit(nutrient: NutrientDef, mode: UnitMode): DisplayUnit {
  const asIs: DisplayUnit = { unit: nutrient.unit, factor: 1 };
  if (mode === "label") return asIs;

  if (mode === "iu") {
    // iuFactors.default is canonical-units-per-IU, so IU = canonical / factor.
    // Only vitamins A, D and E define one; everything else keeps its own unit.
    const perIu = nutrient.iuFactors?.default;
    return perIu ? { unit: "IU", factor: 1 / perIu } : asIs;
  }

  const from = MASS_IN_MCG[nutrient.unit];
  const to = MASS_IN_MCG[mode];
  return from && to ? { unit: mode, factor: from / to } : asIs;
}
