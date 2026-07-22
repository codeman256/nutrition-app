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

const DAY_MS = 86_400_000;

/** Average servings consumed per day: perServing × (active weekdays ÷ 7). */
export function dailyServings(servingsPerDay: number, activeDaysPerWeek: number): number {
  if (servingsPerDay <= 0 || activeDaysPerWeek <= 0) return 0;
  return (servingsPerDay * activeDaysPerWeek) / 7;
}

export interface StockProjection {
  /** servings left now, never below 0 */
  servingsRemaining: number;
  /** whole days of supply left at the current schedule */
  daysRemaining: number;
}

/**
 * Project remaining stock. Returns null when we can't estimate — no stock
 * recorded, or nothing is being consumed (not in the regimen).
 */
export function projectStock(
  stockServings: number | null | undefined,
  stockUpdatedAt: Date | null | undefined,
  perDay: number,
  now: Date = new Date(),
): StockProjection | null {
  if (stockServings == null || perDay <= 0) return null;

  const asOf = stockUpdatedAt ?? now;
  const daysElapsed = Math.max(0, (now.getTime() - asOf.getTime()) / DAY_MS);
  const consumed = daysElapsed * perDay;
  const servingsRemaining = Math.max(0, stockServings - consumed);
  const daysRemaining = Math.floor(servingsRemaining / perDay);
  return { servingsRemaining, daysRemaining };
}

/** Days at or below this are "low stock" — time to reorder. */
export const LOW_STOCK_DAYS = 14;
