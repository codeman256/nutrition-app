import { describe, expect, it } from "vitest";
import { dailyServings, doseUnitsPerDay, projectStock } from "./stock";

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

describe("doseUnitsPerDay", () => {
  it("2 tablets once daily = 2 units/day", () => {
    expect(doseUnitsPerDay(2, 1, "day")).toBe(2);
  });
  it("1 unit three times daily = 3 units/day", () => {
    expect(doseUnitsPerDay(1, 3, "day")).toBe(3);
  });
  it("1 unit once weekly = 1/7 units/day", () => {
    expect(doseUnitsPerDay(1, 1, "week")).toBeCloseTo(1 / 7);
  });
  it("is zero when the dose is incomplete", () => {
    expect(doseUnitsPerDay(null, 1, "day")).toBe(0);
    expect(doseUnitsPerDay(2, 0, "day")).toBe(0);
  });
});

describe("projectStock", () => {
  it("returns null without a recorded amount or consumption", () => {
    expect(projectStock(null, NOW, 1, NOW)).toBeNull();
    expect(projectStock(60, NOW, 0, NOW)).toBeNull();
  });

  it("gives full supply the day it's recorded", () => {
    // 250 tablets at 2/day -> 125 days (the user's example).
    const p = projectStock(250, NOW, 2, NOW);
    expect(p).toEqual({ amountRemaining: 250, daysRemaining: 125 });
  });

  it("decrements as days pass at the daily rate", () => {
    const p = projectStock(60, daysAgo(10), 1);
    expect(p?.amountRemaining).toBeCloseTo(50, 5);
    expect(p?.daysRemaining).toBe(50);
  });

  it("never goes below zero", () => {
    const p = projectStock(10, daysAgo(100), 1);
    expect(p).toEqual({ amountRemaining: 0, daysRemaining: 0 });
  });

  it("floors partial days", () => {
    const p = projectStock(5, NOW, 2, NOW);
    expect(p?.daysRemaining).toBe(2);
  });
});
