import { describe, expect, it } from "vitest";
import { NUTRIENT_BY_ID, matchNutrient } from "@/data/nutrients";
import { getDri } from "@/data/dri";
import {
  EVERY_DAY,
  activeDayCount,
  computeDay,
  isActiveOnDay,
  parseUnit,
  toCanonicalAmount,
  weekdayFromDate,
  whatIf,
  type ProductInput,
  type RegimenItemInput,
} from "@/lib/planner";

const adultMale = { sex: "male" as const, age: 35 };
const adultFemale = { sex: "female" as const, age: 28 };

const vitD = NUTRIENT_BY_ID.get("vitamin_d")!;
const vitE = NUTRIENT_BY_ID.get("vitamin_e")!;
const vitA = NUTRIENT_BY_ID.get("vitamin_a")!;
const magnesium = NUTRIENT_BY_ID.get("magnesium")!;

describe("unit parsing", () => {
  it("normalizes unit spellings", () => {
    expect(parseUnit("mcg")).toBe("mcg");
    expect(parseUnit("µg")).toBe("mcg");
    expect(parseUnit("UG")).toBe("mcg");
    expect(parseUnit(" IU ")).toBe("IU");
    expect(parseUnit("Mg")).toBe("mg");
    expect(parseUnit("g")).toBe("g");
    expect(parseUnit("bottles")).toBeNull();
  });
});

describe("IU conversions", () => {
  it("converts vitamin D IU to mcg (40 IU = 1 mcg)", () => {
    expect(toCanonicalAmount(vitD, 1000, "IU")).toBeCloseTo(25);
    expect(toCanonicalAmount(vitD, 5000, "IU", "d3")).toBeCloseTo(125);
  });

  it("converts vitamin E IU by form", () => {
    expect(toCanonicalAmount(vitE, 100, "IU", "natural")).toBeCloseTo(67);
    expect(toCanonicalAmount(vitE, 100, "IU", "synthetic")).toBeCloseTo(45);
    // unknown form falls back to natural factor
    expect(toCanonicalAmount(vitE, 100, "IU")).toBeCloseTo(67);
  });

  it("converts vitamin A IU by form", () => {
    expect(toCanonicalAmount(vitA, 10000, "IU", "retinol")).toBeCloseTo(3000);
    expect(toCanonicalAmount(vitA, 10000, "IU", "beta_carotene")).toBeCloseTo(1500);
  });

  it("rejects IU for nutrients without IU factors", () => {
    expect(toCanonicalAmount(magnesium, 100, "IU")).toBeNull();
  });
});

describe("mass conversions", () => {
  it("converts between metric mass units", () => {
    // magnesium canonical mg
    expect(toCanonicalAmount(magnesium, 0.4, "g")).toBeCloseTo(400);
    expect(toCanonicalAmount(magnesium, 500000, "mcg")).toBeCloseTo(500);
    // vitamin D canonical mcg
    expect(toCanonicalAmount(vitD, 0.05, "mg")).toBeCloseTo(50);
  });

  it("rejects negative and non-finite amounts", () => {
    expect(toCanonicalAmount(magnesium, -5, "mg")).toBeNull();
    expect(toCanonicalAmount(magnesium, Number.NaN, "mg")).toBeNull();
  });
});

describe("nutrient label matching", () => {
  it("matches common label names", () => {
    expect(matchNutrient("Vitamin D3 (as Cholecalciferol)")?.id).toBe("vitamin_d");
    expect(matchNutrient("Magnesium (as magnesium bisglycinate)")?.id).toBe("magnesium");
    expect(matchNutrient("Folic Acid")?.id).toBe("folate");
    expect(matchNutrient("Vitamin B-12 (methylcobalamin)")?.id).toBe("vitamin_b12");
    expect(matchNutrient("Ashwagandha root extract")).toBeNull();
  });

  it("prefers the more specific alias", () => {
    // "vitamin b12" must win over "vitamin b1"
    expect(matchNutrient("vitamin b12")?.id).toBe("vitamin_b12");
  });
});

describe("DRI lookup", () => {
  it("returns adult male values", () => {
    const d = getDri("vitamin_d", adultMale);
    expect(d.recommended).toBe(15);
    expect(d.ul).toBe(100);
    const mg = getDri("magnesium", adultMale);
    expect(mg.recommended).toBe(420);
    expect(mg.ul).toBe(350); // supplemental UL
  });

  it("applies pregnancy overrides", () => {
    const folate = getDri("folate", { ...adultFemale, pregnant: true });
    expect(folate.recommended).toBe(600);
    const iron = getDri("iron", { ...adultFemale, pregnant: true });
    expect(iron.recommended).toBe(27);
  });

  it("differs by sex and age", () => {
    expect(getDri("iron", adultFemale).recommended).toBe(18);
    expect(getDri("iron", adultMale).recommended).toBe(8);
    expect(getDri("vitamin_d", { sex: "male", age: 75 }).recommended).toBe(20);
  });
});

describe("weekly schedule", () => {
  it("reads the Monday-first bitmask", () => {
    const monWedFri = 0b0010101;
    expect(isActiveOnDay(monWedFri, 0)).toBe(true);
    expect(isActiveOnDay(monWedFri, 1)).toBe(false);
    expect(isActiveOnDay(monWedFri, 2)).toBe(true);
    expect(isActiveOnDay(monWedFri, 6)).toBe(false);
    expect(activeDayCount(monWedFri)).toBe(3);
    expect(activeDayCount(EVERY_DAY)).toBe(7);
  });

  it("maps JS dates to Monday-first weekdays", () => {
    expect(weekdayFromDate(new Date("2026-07-20T12:00:00"))).toBe(0); // Monday
    expect(weekdayFromDate(new Date("2026-07-19T12:00:00"))).toBe(6); // Sunday
  });
});

const d3Product: ProductInput = {
  id: 1,
  name: "Vitamin D3 5000 IU",
  ingredients: [
    { nutrientId: "vitamin_d", amountPerServing: 5000, unit: "IU", form: "d3" },
  ],
};

const multiProduct: ProductInput = {
  id: 2,
  name: "Daily Multi",
  ingredients: [
    { nutrientId: "vitamin_d", amountPerServing: 1000, unit: "IU" },
    { nutrientId: "magnesium", amountPerServing: 100, unit: "mg" },
    { nutrientId: null, amountPerServing: 50, unit: "mg" }, // untracked herb
  ],
};

describe("computeDay", () => {
  it("sums contributions across products and flags over-UL", () => {
    const regimen: RegimenItemInput[] = [
      { productId: 1, servingsPerDay: 1, daysOfWeek: EVERY_DAY },
      { productId: 2, servingsPerDay: 1, daysOfWeek: EVERY_DAY },
    ];
    const plan = computeDay([d3Product, multiProduct], regimen, 0, adultMale);

    const d = plan.rows.find((r) => r.nutrient.id === "vitamin_d")!;
    // 5000 IU + 1000 IU = 6000 IU = 150 mcg, over the 100 mcg UL
    expect(d.total).toBeCloseTo(150);
    expect(d.contributions[1]).toBeCloseTo(125);
    expect(d.contributions[2]).toBeCloseTo(25);
    expect(d.status).toBe("over-ul");
    expect(plan.overUl.map((r) => r.nutrient.id)).toContain("vitamin_d");

    const mg = plan.rows.find((r) => r.nutrient.id === "magnesium")!;
    expect(mg.total).toBeCloseTo(100);
    expect(mg.status).toBe("below-rda");
  });

  it("multiplies by servings per day", () => {
    const regimen: RegimenItemInput[] = [
      { productId: 2, servingsPerDay: 2, daysOfWeek: EVERY_DAY },
    ];
    const plan = computeDay([multiProduct], regimen, 3, adultMale);
    expect(plan.rows.find((r) => r.nutrient.id === "magnesium")!.total).toBeCloseTo(200);
  });

  it("differs by weekday when products are scheduled Mon/Wed/Fri", () => {
    const monWedFri = 0b0010101;
    const regimen: RegimenItemInput[] = [
      { productId: 1, servingsPerDay: 1, daysOfWeek: monWedFri },
    ];
    const monday = computeDay([d3Product], regimen, 0, adultMale);
    const tuesday = computeDay([d3Product], regimen, 1, adultMale);
    expect(monday.rows).toHaveLength(1);
    expect(tuesday.rows).toHaveLength(0);
    expect(tuesday.products).toHaveLength(0);
  });

  it("grades near-ul and meets-rda", () => {
    const d3Small: ProductInput = {
      id: 3,
      name: "D3 3400 IU",
      ingredients: [
        { nutrientId: "vitamin_d", amountPerServing: 3400, unit: "IU" },
      ],
    };
    const regimen: RegimenItemInput[] = [
      { productId: 3, servingsPerDay: 1, daysOfWeek: EVERY_DAY },
    ];
    // 3400 IU = 85 mcg → ≥ 80% of the 100 mcg UL
    const plan = computeDay([d3Small], regimen, 0, adultMale);
    expect(plan.rows[0].status).toBe("near-ul");

    const mgProduct: ProductInput = {
      id: 4,
      name: "Mag 200",
      ingredients: [
        { nutrientId: "magnesium", amountPerServing: 200, unit: "mg" },
      ],
    };
    const plan2 = computeDay(
      [mgProduct],
      [{ productId: 4, servingsPerDay: 1, daysOfWeek: EVERY_DAY }],
      0,
      { sex: "female", age: 28 },
    );
    // 200 mg < 310 RDA and < 80% of 350 UL
    expect(plan2.rows[0].status).toBe("below-rda");
  });
});

describe("whatIf", () => {
  it("reports nutrients newly pushed over the UL", () => {
    const regimen: RegimenItemInput[] = [
      { productId: 1, servingsPerDay: 1, daysOfWeek: EVERY_DAY },
    ];
    const extraD: ProductInput = {
      id: 9,
      name: "Extra D3 2000 IU",
      ingredients: [
        { nutrientId: "vitamin_d", amountPerServing: 2000, unit: "IU" },
      ],
    };
    const result = whatIf([d3Product], regimen, extraD, 1, 0, adultMale);
    // 5000 IU (125 mcg) alone is over already? 125 > 100 — yes, already over.
    expect(result.newlyOverUl).toHaveLength(0);

    // Start under the UL instead: 3000 IU = 75 mcg, then add 2000 IU more.
    const d3Mid: ProductInput = {
      id: 10,
      name: "D3 3000 IU",
      ingredients: [
        { nutrientId: "vitamin_d", amountPerServing: 3000, unit: "IU" },
      ],
    };
    const result2 = whatIf(
      [d3Mid],
      [{ productId: 10, servingsPerDay: 1, daysOfWeek: EVERY_DAY }],
      extraD,
      1,
      0,
      adultMale,
    );
    expect(result2.before.overUl).toHaveLength(0);
    expect(result2.newlyOverUl.map((r) => r.nutrient.id)).toEqual(["vitamin_d"]);
  });
});
