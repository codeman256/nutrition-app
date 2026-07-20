import { describe, expect, it } from "vitest";
import { NUTRIENTS } from "./nutrients";

/**
 * The dashboard aggregates several products, so it needs one canonical order.
 * Health Canada mandates no ordering for NHP labels, so we follow the US rule,
 * which does: 21 CFR 101.36 defers to the sequence in 21 CFR 101.9(c).
 *
 * Chloride and fluoride appear in the regulation but aren't tracked here.
 */
const FDA_SEQUENCE = [
  "vitamin_a",
  "vitamin_c",
  "vitamin_d",
  "vitamin_e",
  "vitamin_k",
  "thiamin",
  "riboflavin",
  "niacin",
  "vitamin_b6",
  "folate",
  "vitamin_b12",
  "biotin",
  "pantothenic_acid",
  "choline",
  "calcium",
  "iron",
  "phosphorus",
  "iodine",
  "magnesium",
  "zinc",
  "selenium",
  "copper",
  "manganese",
  "chromium",
  "molybdenum",
  "sodium",
  "potassium",
];

describe("canonical nutrient order", () => {
  it("follows the FDA Supplement Facts sequence", () => {
    const ours = [...NUTRIENTS]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((n) => n.id);
    expect(ours).toEqual(FDA_SEQUENCE);
  });

  it("gives every nutrient a distinct sort position", () => {
    const orders = NUTRIENTS.map((n) => n.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
