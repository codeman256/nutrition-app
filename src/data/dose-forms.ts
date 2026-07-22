/**
 * Physical dose forms (what one "unit" of a product is) and how they map to a
 * placeholder pill shape. Used by the dosage fields and to prefill the pill
 * designer from an imported product's form.
 */

import { DEFAULT_PILL, serializePill } from "@/data/pills";

export interface DoseForm {
  value: string;
  label: string;
  /** pill shape key from src/data/pills.ts */
  pillShape: "capsule" | "caplet" | "round" | "softgel";
}

export const DOSE_FORMS: DoseForm[] = [
  { value: "tablet", label: "Tablet", pillShape: "round" },
  { value: "caplet", label: "Caplet", pillShape: "caplet" },
  { value: "capsule", label: "Capsule", pillShape: "capsule" },
  { value: "softgel", label: "Softgel", pillShape: "softgel" },
  { value: "chewable", label: "Chewable", pillShape: "round" },
  { value: "gummy", label: "Gummy", pillShape: "round" },
  { value: "lozenge", label: "Lozenge", pillShape: "round" },
  { value: "powder", label: "Powder (scoop)", pillShape: "round" },
  { value: "liquid", label: "Liquid (mL)", pillShape: "softgel" },
  { value: "drop", label: "Drops", pillShape: "softgel" },
  { value: "spray", label: "Spray", pillShape: "softgel" },
  { value: "other", label: "Other / unit", pillShape: "capsule" },
];

const BY_VALUE = new Map(DOSE_FORMS.map((f) => [f.value, f]));

/**
 * Map a free-text form from an API/label ("Tablet(s)", "Soft Gelatin Capsule",
 * "capsule", "Tablet, chewable") onto one of our known forms.
 */
export function normalizeDoseForm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/chew/.test(s)) return "chewable";
  if (/gum/.test(s)) return "gummy";
  if (/lozenge|pastille/.test(s)) return "lozenge";
  if (/soft\s*gel|softgel|gelcap|soft gelatin/.test(s)) return "softgel";
  if (/caplet/.test(s)) return "caplet";
  if (/cap/.test(s)) return "capsule";
  if (/tablet|pill/.test(s)) return "tablet";
  if (/powder|scoop/.test(s)) return "powder";
  if (/liquid|syrup|\bml\b|millilit/.test(s)) return "liquid";
  if (/drop/.test(s)) return "drop";
  if (/spray/.test(s)) return "spray";
  return null;
}

export function doseFormLabel(value: string | null | undefined): string {
  return (value && BY_VALUE.get(value)?.label) || "unit";
}

/** Plural noun for a form, for "250 tablets" style text. */
export function doseFormNoun(value: string | null | undefined, count = 2): string {
  const base = doseFormLabel(value).replace(/ \(.*\)$/, "").toLowerCase();
  if (count === 1) return base;
  return base.endsWith("y") ? base.slice(0, -1) + "ies" : base + "s";
}

export function pillShapeForDoseForm(value: string | null | undefined): DoseForm["pillShape"] | null {
  if (!value) return null;
  return BY_VALUE.get(value)?.pillShape ?? null;
}

/** A serialized pill appearance with the shape implied by the dose form. */
export function pillStyleForDoseForm(value: string | null | undefined): string | null {
  const shape = pillShapeForDoseForm(value);
  if (!shape) return null;
  return serializePill({ ...DEFAULT_PILL, shape });
}

export const DOSE_PERIODS: { value: string; label: string; days: number }[] = [
  { value: "day", label: "day", days: 1 },
  { value: "week", label: "week", days: 7 },
  { value: "month", label: "month", days: 30 },
];

export function periodDays(period: string | null | undefined): number {
  return DOSE_PERIODS.find((p) => p.value === period)?.days ?? 1;
}
