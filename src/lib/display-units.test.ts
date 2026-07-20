import { describe, expect, it } from "vitest";
import { NUTRIENT_BY_ID } from "@/data/nutrients";
import { displayUnit } from "./display-units";

const nutrient = (id: string) => {
  const found = NUTRIENT_BY_ID.get(id);
  if (!found) throw new Error(`missing nutrient fixture: ${id}`);
  return found;
};

const vitaminA = nutrient("vitamin_a");
const vitaminD = nutrient("vitamin_d");
const vitaminE = nutrient("vitamin_e");
const vitaminC = nutrient("vitamin_c");

/** Amount as it would appear on screen. */
const shown = (n: number, d: { factor: number }) => n * d.factor;

describe("displayUnit", () => {
  it("leaves everything alone in label mode", () => {
    const d = displayUnit(vitaminD, "label");
    expect(d).toEqual({ unit: "mcg", factor: 1 });
    expect(shown(25, d)).toBe(25);
  });

  it("converts mg nutrients to mcg", () => {
    const d = displayUnit(vitaminC, "mcg");
    expect(d.unit).toBe("mcg");
    expect(shown(90, d)).toBe(90_000);
  });

  it("converts mcg nutrients to mg", () => {
    const d = displayUnit(vitaminD, "mg");
    expect(d.unit).toBe("mg");
    expect(shown(25, d)).toBeCloseTo(0.025, 6);
  });

  it("is a no-op when the nutrient is already in the requested unit", () => {
    expect(displayUnit(vitaminC, "mg")).toEqual({ unit: "mg", factor: 1 });
  });

  describe("IU mode", () => {
    it("converts vitamin D mcg to IU (25 mcg = 1000 IU)", () => {
      const d = displayUnit(vitaminD, "iu");
      expect(d.unit).toBe("IU");
      expect(shown(25, d)).toBeCloseTo(1000, 6);
    });

    it("converts vitamin A mcg RAE to IU (900 RAE = 3000 IU)", () => {
      const d = displayUnit(vitaminA, "iu");
      expect(shown(900, d)).toBeCloseTo(3000, 6);
    });

    it("converts vitamin E mg to IU (15 mg natural ~= 22.4 IU)", () => {
      const d = displayUnit(vitaminE, "iu");
      expect(shown(15, d)).toBeCloseTo(22.39, 1);
    });

    it("leaves nutrients with no IU equivalent in their own unit", () => {
      // Vitamin C has no meaningful IU, so it must not be relabelled.
      expect(displayUnit(vitaminC, "iu")).toEqual({ unit: "mg", factor: 1 });
    });
  });

  it("round-trips: converting to mcg and back to the label unit is lossless", () => {
    const toMcg = displayUnit(vitaminC, "mcg");
    const back = shown(90, toMcg) / toMcg.factor;
    expect(back).toBeCloseTo(90, 9);
  });
});
