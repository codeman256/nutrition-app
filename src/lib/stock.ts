/**
 * Stock projection (F2). Pure functions — no DB, no time source of their own,
 * so they're easy to unit-test.
 *
 * The model: a product records how many servings were on hand at a moment
 * (`stockServings` as of `stockUpdatedAt`). Given the regimen's average daily
 * consumption, we project how many servings remain now and how many days of
 * supply are left. There's no adherence tracking — this is a planning estimate
 * assuming the schedule is followed.
 */

import { periodDays } from "@/data/dose-forms";

const DAY_MS = 86_400_000;

/** Average servings consumed per day: perServing × (active weekdays ÷ 7). */
export function dailyServings(servingsPerDay: number, activeDaysPerWeek: number): number {
  if (servingsPerDay <= 0 || activeDaysPerWeek <= 0) return 0;
  return (servingsPerDay * activeDaysPerWeek) / 7;
}

/**
 * Units consumed per day from a product's label dose — doseAmount units taken
 * doseFrequency times per period (day/week/month). E.g. 2 tablets once daily
 * = 2 units/day; 1 tablet 3× daily = 3 units/day.
 */
export function doseUnitsPerDay(
  doseAmount: number | null | undefined,
  doseFrequency: number | null | undefined,
  dosePeriod: string | null | undefined,
): number {
  const amount = doseAmount ?? 0;
  const freq = doseFrequency ?? 0;
  if (amount <= 0 || freq <= 0) return 0;
  return (amount * freq) / periodDays(dosePeriod);
}

/**
 * Units consumed per day from the user's *actual* regimen: their servings/day
 * on active weekdays, times the units in one serving (doseAmount). This drives
 * stock days-remaining, so it reflects what they really take rather than the
 * label's recommended dose. A serving with no known unit count is treated as
 * one unit.
 */
export function regimenUnitsPerDay(
  servingsPerDay: number,
  activeDaysPerWeek: number,
  unitsPerServing: number | null | undefined,
): number {
  const perServing = unitsPerServing && unitsPerServing > 0 ? unitsPerServing : 1;
  return dailyServings(servingsPerDay, activeDaysPerWeek) * perServing;
}

export interface StockProjection {
  /** amount left now (units), never below 0 */
  amountRemaining: number;
  /** whole days of supply left at the current rate */
  daysRemaining: number;
}

/**
 * Project remaining stock from an amount recorded at a moment and a
 * consumption rate per day. Unit-agnostic (units or servings). Returns null
 * when there's nothing recorded or nothing is being consumed.
 */
export function projectStock(
  amountOnHand: number | null | undefined,
  asOf: Date | null | undefined,
  perDay: number,
  now: Date = new Date(),
): StockProjection | null {
  if (amountOnHand == null || perDay <= 0) return null;

  const from = asOf ?? now;
  const daysElapsed = Math.max(0, (now.getTime() - from.getTime()) / DAY_MS);
  const amountRemaining = Math.max(0, amountOnHand - daysElapsed * perDay);
  const daysRemaining = Math.floor(amountRemaining / perDay);
  return { amountRemaining, daysRemaining };
}

/** Days at or below this are "low stock" — time to reorder. */
export const LOW_STOCK_DAYS = 14;
