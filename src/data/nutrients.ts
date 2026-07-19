/**
 * Canonical nutrient dictionary.
 *
 * Every nutrient has one canonical unit; imported label data (DSLD, LNHPD,
 * OCR) is converted into it. Aliases are lowercase substrings used to match
 * ingredient names as printed on labels.
 */

export type Unit = "mcg" | "mg" | "g" | "IU";

export interface NutrientDef {
  id: string;
  name: string;
  unit: Exclude<Unit, "IU">;
  /** lowercase name fragments used to match label ingredient names */
  aliases: string[];
  /**
   * IU-to-canonical-unit factors keyed by form; `default` is used when the
   * form is unknown. Only nutrients historically labelled in IU have this.
   */
  iuFactors?: Record<string, number>;
  sortOrder: number;
}

export const NUTRIENTS: NutrientDef[] = [
  {
    id: "vitamin_a",
    name: "Vitamin A",
    unit: "mcg", // mcg RAE
    aliases: ["vitamin a", "retinol", "retinyl", "beta-carotene", "beta carotene"],
    // 1 IU retinol = 0.3 mcg RAE; 1 IU beta-carotene (supplement) = 0.15 mcg RAE
    iuFactors: { default: 0.3, retinol: 0.3, beta_carotene: 0.15 },
    sortOrder: 10,
  },
  {
    id: "vitamin_c",
    name: "Vitamin C",
    unit: "mg",
    aliases: ["vitamin c", "ascorbic acid", "ascorbate"],
    sortOrder: 20,
  },
  {
    id: "vitamin_d",
    name: "Vitamin D",
    unit: "mcg",
    aliases: ["vitamin d", "cholecalciferol", "ergocalciferol"],
    // 40 IU = 1 mcg
    iuFactors: { default: 0.025, d2: 0.025, d3: 0.025 },
    sortOrder: 30,
  },
  {
    id: "vitamin_e",
    name: "Vitamin E",
    unit: "mg", // mg alpha-tocopherol
    aliases: ["vitamin e", "tocopherol", "tocopheryl"],
    // natural (d-) 1 IU = 0.67 mg; synthetic (dl-) 1 IU = 0.45 mg
    iuFactors: { default: 0.67, natural: 0.67, synthetic: 0.45 },
    sortOrder: 40,
  },
  {
    id: "vitamin_k",
    name: "Vitamin K",
    unit: "mcg",
    aliases: ["vitamin k", "phylloquinone", "menaquinone", "mk-7", "mk-4"],
    sortOrder: 50,
  },
  {
    id: "thiamin",
    name: "Thiamin (B1)",
    unit: "mg",
    aliases: ["thiamin", "thiamine", "vitamin b1", "vitamin b-1"],
    sortOrder: 60,
  },
  {
    id: "riboflavin",
    name: "Riboflavin (B2)",
    unit: "mg",
    aliases: ["riboflavin", "vitamin b2", "vitamin b-2"],
    sortOrder: 70,
  },
  {
    id: "niacin",
    name: "Niacin (B3)",
    unit: "mg", // mg NE
    aliases: ["niacin", "niacinamide", "nicotinamide", "vitamin b3", "vitamin b-3"],
    sortOrder: 80,
  },
  {
    id: "vitamin_b6",
    name: "Vitamin B6",
    unit: "mg",
    aliases: ["vitamin b6", "vitamin b-6", "pyridoxine", "pyridoxal"],
    sortOrder: 90,
  },
  {
    id: "folate",
    name: "Folate (B9)",
    unit: "mcg", // mcg DFE
    aliases: ["folate", "folic acid", "folacin", "methylfolate", "vitamin b9"],
    sortOrder: 100,
  },
  {
    id: "vitamin_b12",
    name: "Vitamin B12",
    unit: "mcg",
    aliases: ["vitamin b12", "vitamin b-12", "cobalamin", "cyanocobalamin", "methylcobalamin"],
    sortOrder: 110,
  },
  {
    id: "biotin",
    name: "Biotin (B7)",
    unit: "mcg",
    aliases: ["biotin", "vitamin b7", "vitamin h"],
    sortOrder: 120,
  },
  {
    id: "pantothenic_acid",
    name: "Pantothenic acid (B5)",
    unit: "mg",
    aliases: ["pantothenic", "pantothenate", "vitamin b5", "vitamin b-5"],
    sortOrder: 130,
  },
  {
    id: "choline",
    name: "Choline",
    unit: "mg",
    aliases: ["choline"],
    sortOrder: 140,
  },
  {
    id: "calcium",
    name: "Calcium",
    unit: "mg",
    aliases: ["calcium"],
    sortOrder: 200,
  },
  {
    id: "iron",
    name: "Iron",
    unit: "mg",
    aliases: ["iron", "ferrous", "ferric"],
    sortOrder: 210,
  },
  {
    id: "magnesium",
    name: "Magnesium",
    unit: "mg",
    aliases: ["magnesium"],
    sortOrder: 220,
  },
  {
    id: "zinc",
    name: "Zinc",
    unit: "mg",
    aliases: ["zinc"],
    sortOrder: 230,
  },
  {
    id: "selenium",
    name: "Selenium",
    unit: "mcg",
    aliases: ["selenium"],
    sortOrder: 240,
  },
  {
    id: "copper",
    name: "Copper",
    unit: "mg",
    aliases: ["copper", "cupric"],
    sortOrder: 250,
  },
  {
    id: "manganese",
    name: "Manganese",
    unit: "mg",
    aliases: ["manganese"],
    sortOrder: 260,
  },
  {
    id: "iodine",
    name: "Iodine",
    unit: "mcg",
    aliases: ["iodine", "iodide", "kelp"],
    sortOrder: 270,
  },
  {
    id: "chromium",
    name: "Chromium",
    unit: "mcg",
    aliases: ["chromium"],
    sortOrder: 280,
  },
  {
    id: "molybdenum",
    name: "Molybdenum",
    unit: "mcg",
    aliases: ["molybdenum"],
    sortOrder: 290,
  },
  {
    id: "potassium",
    name: "Potassium",
    unit: "mg",
    aliases: ["potassium"],
    sortOrder: 300,
  },
  {
    id: "phosphorus",
    name: "Phosphorus",
    unit: "mg",
    aliases: ["phosphorus", "phosphate"],
    sortOrder: 310,
  },
  {
    id: "sodium",
    name: "Sodium",
    unit: "mg",
    aliases: ["sodium"],
    sortOrder: 320,
  },
];

export const NUTRIENT_BY_ID = new Map(NUTRIENTS.map((n) => [n.id, n]));

/** Match a label ingredient name to a canonical nutrient, or null. */
export function matchNutrient(labelName: string): NutrientDef | null {
  const needle = labelName.toLowerCase();
  let best: NutrientDef | null = null;
  let bestLen = 0;
  for (const nutrient of NUTRIENTS) {
    for (const alias of nutrient.aliases) {
      if (needle.includes(alias) && alias.length > bestLen) {
        best = nutrient;
        bestLen = alias.length;
      }
    }
  }
  return best;
}
