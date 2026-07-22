import { describe, expect, it } from "vitest";
import { formatUpcForDsld, pickServingQuantity } from "./dsld";

describe("formatUpcForDsld", () => {
  it("spaces a 12-digit UPC-A the way DSLD stores it", () => {
    expect(formatUpcForDsld("027917021522")).toBe("0 27917 02152 2");
  });
  it("drops a leading zero from an EAN-13", () => {
    expect(formatUpcForDsld("0027917021522")).toBe("0 27917 02152 2");
  });
});

describe("pickServingQuantity (C2 — multi-serving labels)", () => {
  const base = { order: 1, minQuantity: 22.5, unit: "Gram(s)" };

  it("returns the only entry when there's just one", () => {
    const q = [{ quantity: 400, unit: "IU", servingSizeOrder: 1 }];
    expect(pickServingQuantity(q, base)?.quantity).toBe(400);
  });

  it("picks the column stated for the base serving amount", () => {
    // MacroMeal "1-2 scoops": 22.5 g -> 90, 45 g -> 180. Base is 22.5 g.
    const q = [
      { quantity: 90, unit: "Calorie(s)", servingSizeOrder: 1, servingSizeQuantity: 22.5 },
      { quantity: 180, unit: "Calorie(s)", servingSizeOrder: 1, servingSizeQuantity: 45 },
    ];
    expect(pickServingQuantity(q, base)?.quantity).toBe(90);
  });

  it("prefers the matching serving-size column (order) first", () => {
    const q = [
      { quantity: 5, unit: "mg", servingSizeOrder: 2, servingSizeQuantity: 45 },
      { quantity: 2, unit: "mg", servingSizeOrder: 1, servingSizeQuantity: 22.5 },
    ];
    expect(pickServingQuantity(q, base)?.quantity).toBe(2);
  });

  it("falls back to the smallest serving when nothing matches exactly", () => {
    const q = [
      { quantity: 180, unit: "mg", servingSizeOrder: 1, servingSizeQuantity: 45 },
      { quantity: 90, unit: "mg", servingSizeOrder: 1, servingSizeQuantity: 30 },
    ];
    // base minQuantity 22.5 matches neither -> smallest (30 g) wins
    expect(pickServingQuantity(q, base)?.quantity).toBe(90);
  });

  it("returns undefined for no quantities", () => {
    expect(pickServingQuantity([], base)).toBeUndefined();
    expect(pickServingQuantity(undefined, base)).toBeUndefined();
  });
});
