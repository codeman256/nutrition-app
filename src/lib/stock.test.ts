import { describe, expect, it } from "vitest";
import { dailyServings, projectStock } from "./stock";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const NOW = new Date("2026-07-22T00:00:00Z");

describe("dailyServings", () => {
  it("is servings/day when taken every day", () => {
    expect(dailyServings(2, 7)).toBe(2);
  });
  it("prorates by active weekdays", () => {
    expect(dailyServings(1, 3)).toBeCloseTo(3 / 7);
  });
  it("is zero when nothing is scheduled", () => {
    expect(dailyServings(0, 7)).toBe(0);
    expect(dailyServings(1, 0)).toBe(0);
  });
});

describe("projectStock", () => {
  it("returns null without a recorded stock or consumption", () => {
    expect(projectStock(null, NOW, 1, NOW)).toBeNull();
    expect(projectStock(60, NOW, 0, NOW)).toBeNull();
  });

  it("gives full supply the day it's recorded", () => {
    const p = projectStock(60, NOW, 2, NOW);
    expect(p).toEqual({ servingsRemaining: 60, daysRemaining: 30 });
  });

  it("decrements as days pass at the daily rate", () => {
    // 60 servings, 1/day, recorded 10 days ago -> 50 left, 50 days.
    const p = projectStock(60, daysAgo(10), 1);
    expect(p?.servingsRemaining).toBeCloseTo(50, 5);
    expect(p?.daysRemaining).toBe(50);
  });

  it("never goes below zero", () => {
    const p = projectStock(10, daysAgo(100), 1);
    expect(p).toEqual({ servingsRemaining: 0, daysRemaining: 0 });
  });

  it("floors partial days", () => {
    // 5 servings at 2/day = 2.5 days -> 2 whole days
    const p = projectStock(5, NOW, 2, NOW);
    expect(p?.daysRemaining).toBe(2);
  });
});
