import { describe, expect, it } from "vitest";
import { NUTRIENTS, NUTRIENT_BY_ID, matchNutrient } from "@/data/nutrients";
import { getDri, type DriQuery } from "@/data/dri";
import {
  EVERY_DAY,
  activeDayCount,
  averageWeek,
  computeDay,
  isActiveOnDay,
  iuEquivalent,
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

  it("accepts Health Canada's spelled-out units", () => {
    // The LNHPD API returns "micrograms"/"milligrams", not "mcg"/"mg" — these
    // were silently dropped, so Biotin (NPN 80070102) imported empty.
    expect(parseUnit("micrograms")).toBe("mcg");
    expect(parseUnit("microgram")).toBe("mcg");
    expect(parseUnit("milligrams")).toBe("mg");
    expect(parseUnit("milligram")).toBe("mg");
    expect(parseUnit("International Units")).toBe("IU");
  });

  it("reads the unit through a reference qualifier", () => {
    // Centrum prints "300 mcg RAE/EAR/1000 IU", and Health Canada keeps the
    // qualifier on the unit — these used to parse as blank.
    expect(parseUnit("mcg RAE/EAR")).toBe("mcg");
    expect(parseUnit("µg RE")).toBe("mcg");
    expect(parseUnit("mg AT")).toBe("mg");
    expect(parseUnit("iu/ui")).toBe("IU");
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

  it("converts vitamin A IU by form (both 0.3 IU->RAE)", () => {
    expect(toCanonicalAmount(vitA, 10000, "IU", "retinol")).toBeCloseTo(3000);
    expect(toCanonicalAmount(vitA, 10000, "IU", "beta_carotene")).toBeCloseTo(3000);
  });

  it("converts vitamin A mass by form (beta-carotene mcg -> mcg RAE)", () => {
    // Centrum: retinyl 300 mcg RAE stays 300; beta-carotene 900 mcg -> 450 RAE
    expect(toCanonicalAmount(vitA, 300, "mcg", "retinol")).toBeCloseTo(300);
    expect(toCanonicalAmount(vitA, 900, "mcg", "beta_carotene")).toBeCloseTo(450);
    // unknown form defaults to 1 (treated as already-RAE)
    expect(toCanonicalAmount(vitA, 500, "mcg")).toBeCloseTo(500);
  });

  it("rejects IU for nutrients without IU factors", () => {
    expect(toCanonicalAmount(magnesium, 100, "IU")).toBeNull();
  });
});

describe("IU echo (label confirmation)", () => {
  it("reproduces the IU printed on the Centrum label from the mass amount", () => {
    // Vitamin A acetate 300 mcg RAE = 1000 IU
    expect(iuEquivalent(vitA, 300, "mcg", "retinol")).toBeCloseTo(1000);
    // Beta-Carotene 900 mcg = 1500 IU (via 450 mcg RAE)
    expect(iuEquivalent(vitA, 900, "mcg", "beta_carotene")).toBeCloseTo(1500);
    // Vitamin D 20 mcg = 800 IU
    expect(iuEquivalent(vitD, 20, "mcg")).toBeCloseTo(800);
    // Vitamin E 18 mg dl-alpha (synthetic) = 40 IU
    expect(iuEquivalent(vitE, 18, "mg", "synthetic")).toBeCloseTo(40);
  });

  it("is null when the amount is already in IU or the nutrient has no IU form", () => {
    expect(iuEquivalent(vitD, 800, "IU")).toBeNull();
    expect(iuEquivalent(magnesium, 100, "mg")).toBeNull();
    expect(iuEquivalent(vitA, 0, "mcg", "retinol")).toBeNull();
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

describe("DRI target vs limit invariant", () => {
  // A UL below the target would mean "you can't even reach the recommended
  // amount without passing the safe limit" — for a total-intake figure that's a
  // data-entry error, so this sweep guards the whole table against it.
  //
  // Magnesium is the one legitimate exception: its UL (350 mg for adults)
  // applies to *supplemental* magnesium only, while the RDA (up to 420 mg) is
  // TOTAL intake including food. Different bases, so UL < RDA is correct — and
  // the supplemental figure is exactly what VitaPlan compares against. Any
  // *other* nutrient tripping this check is a real bug in the DRI table.
  const SUPPLEMENT_ONLY_UL_BELOW_RDA = new Set(["magnesium"]);

  const ages = [2, 5, 10, 16, 25, 40, 55, 75];
  const profiles: DriQuery[] = [];
  for (const sex of ["male", "female"] as const) {
    for (const age of ages) {
      profiles.push({ sex, age });
      // Pregnancy/lactation rows only exist for ages 14+.
      if (age >= 14) {
        profiles.push({ sex, age, pregnant: true });
        profiles.push({ sex, age, lactating: true });
      }
    }
  }

  it("keeps every UL at or above the target (magnesium excepted)", () => {
    for (const nutrient of NUTRIENTS) {
      if (SUPPLEMENT_ONLY_UL_BELOW_RDA.has(nutrient.id)) continue;
      for (const profile of profiles) {
        const { recommended, ul } = getDri(nutrient.id, profile);
        if (recommended === null || ul === null) continue;
        expect(
          ul,
          `${nutrient.id} UL ${ul} < target ${recommended} for ${JSON.stringify(profile)}`,
        ).toBeGreaterThanOrEqual(recommended);
      }
    }
  });

  it("confirms magnesium's supplemental UL is intentionally below its RDA", () => {
    // Guards the exception itself: if the data ever changes so magnesium no
    // longer trips the rule, this fails and the allowlist above can be removed.
    const mg = getDri("magnesium", { sex: "male", age: 40 });
    expect(mg.ul).toBeLessThan(mg.recommended!);
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

describe("averageWeek", () => {
  it("divides a partial-week product by 7 (Mon/Wed/Fri magnesium)", () => {
    const monWedFri = 0b0010101; // 3 of 7 days
    const plan = averageWeek(
      [multiProduct],
      [{ productId: 2, servingsPerDay: 1, daysOfWeek: monWedFri }],
      adultMale,
    );
    // 100 mg on 3 days, 0 on the other 4 → (3 × 100) / 7 ≈ 42.86 mg/day
    expect(plan.rows.find((r) => r.nutrient.id === "magnesium")!.total).toBeCloseTo(
      300 / 7,
    );
  });

  it("equals the daily amount for an every-day product", () => {
    const plan = averageWeek(
      [multiProduct],
      [{ productId: 2, servingsPerDay: 1, daysOfWeek: EVERY_DAY }],
      adultMale,
    );
    expect(plan.rows.find((r) => r.nutrient.id === "magnesium")!.total).toBeCloseTo(100);
  });

  it("can sit under a limit on average that a heavy day exceeds", () => {
    // 5000 IU D3 (125 mcg) taken one day a week: over the 100 mcg UL that day,
    // but 125/7 ≈ 17.9 mcg on average — comfortably under.
    const oneDay = 0b0000001; // Monday only
    const day = computeDay(
      [d3Product],
      [{ productId: 1, servingsPerDay: 1, daysOfWeek: oneDay }],
      0,
      adultMale,
    );
    expect(day.rows.find((r) => r.nutrient.id === "vitamin_d")!.status).toBe("over-ul");

    const avg = averageWeek(
      [d3Product],
      [{ productId: 1, servingsPerDay: 1, daysOfWeek: oneDay }],
      adultMale,
    );
    const d = avg.rows.find((r) => r.nutrient.id === "vitamin_d")!;
    expect(d.total).toBeCloseTo(125 / 7);
    expect(d.status).not.toBe("over-ul");
  });
});
