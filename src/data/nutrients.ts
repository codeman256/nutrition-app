/**
 * Canonical nutrient dictionary.
 *
 * Every nutrient has one canonical unit; imported label data (DSLD, LNHPD,
 * OCR) is converted into it. Aliases are lowercase substrings used to match
 * ingredient names as printed on labels.
 */

export type Unit = "mcg" | "mg" | "g" | "IU";

export interface NutrientForm {
  value: string;
  label: string;
}

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
  /**
   * Multipliers applied when the amount is in a MASS unit but the labelled
   * form differs from the canonical form (e.g. mcg β-carotene → mcg RAE ×0.5).
   * `default` = 1 when omitted.
   */
  massFormFactors?: Record<string, number>;
  /** Selectable forms shown in the product form for this nutrient. */
  forms?: NutrientForm[];
  /** NIH ODS fact-sheet URL, for the dashboard status/source link. */
  factSheet?: string;
  /** FDA adult Daily Value in the canonical unit — powers the %DV column. */
  dailyValue?: number;
  /** Short plain-language help shown on the product form for tricky rows. */
  note?: string;
  sortOrder: number;
}

export const NUTRIENTS: NutrientDef[] = [
  {
    id: "vitamin_a",
    name: "Vitamin A",
    unit: "mcg", // mcg RAE
    aliases: ["vitamin a", "retinol", "retinyl", "beta-carotene", "beta carotene"],
    // IU→RAE: retinol and supplemental beta-carotene are both 0.3 (NIH ODS)
    iuFactors: { default: 0.3, retinol: 0.3, beta_carotene: 0.3 },
    // mass→RAE: 1 mcg retinol = 1 mcg RAE; 2 mcg supplemental beta-carotene = 1
    massFormFactors: { default: 1, retinol: 1, beta_carotene: 0.5 },
    forms: [
      { value: "retinol", label: "Retinol / retinyl (preformed, or “mcg RAE”)" },
      { value: "beta_carotene", label: "Beta-carotene" },
    ],
    note: "Bottles often list two vitamin A lines. A “Vitamin A (retinyl…) mcg RAE” line is already RAE — pick Retinol. A separate “Beta-Carotene ___ mcg” line is a different form: pick Beta-carotene and VitaPlan converts it (2 mcg β-carotene = 1 mcg RAE). Enter each line as its own row.",
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
    note: "Vitamin D is often shown in both mcg and IU (40 IU = 1 mcg). Enter either — if the label says IU, choose the IU unit and VitaPlan converts it.",
    sortOrder: 30,
  },
  {
    id: "vitamin_e",
    name: "Vitamin E",
    unit: "mg", // mg alpha-tocopherol
    aliases: ["vitamin e", "tocopherol", "tocopheryl"],
    // natural (d-) 1 IU = 0.67 mg; synthetic (dl-) 1 IU = 0.45 mg
    iuFactors: { default: 0.67, natural: 0.67, synthetic: 0.45 },
    forms: [
      { value: "natural", label: "Natural (d-alpha / RRR-)" },
      { value: "synthetic", label: "Synthetic (dl-alpha / all-rac-)" },
    ],
    note: "If the label gives IU, the natural (d-alpha) vs synthetic (dl-alpha) form changes the conversion. Modern labels in mg are already alpha-tocopherol — leave the form as-is.",
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
    note: "Enter the mcg printed on the label. The safe upper limit is set for synthetic folic acid, so VitaPlan compares your total to it directly. (The RDA is technically in DFE, where folic acid counts 1.7×, so your % of target is slightly conservative.)",
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

/**
 * NIH ODS fact-sheet slug + FDA adult Daily Value (2016 Nutrition Facts label,
 * in each nutrient's canonical unit). Merged into NUTRIENTS below to keep the
 * definitions above readable.
 */
const REFERENCE: Record<string, { slug: string; dv: number }> = {
  vitamin_a: { slug: "VitaminA", dv: 900 },
  vitamin_c: { slug: "VitaminC", dv: 90 },
  vitamin_d: { slug: "VitaminD", dv: 20 },
  vitamin_e: { slug: "VitaminE", dv: 15 },
  vitamin_k: { slug: "VitaminK", dv: 120 },
  thiamin: { slug: "Thiamin", dv: 1.2 },
  riboflavin: { slug: "Riboflavin", dv: 1.3 },
  niacin: { slug: "Niacin", dv: 16 },
  vitamin_b6: { slug: "VitaminB6", dv: 1.7 },
  folate: { slug: "Folate", dv: 400 },
  vitamin_b12: { slug: "VitaminB12", dv: 2.4 },
  biotin: { slug: "Biotin", dv: 30 },
  pantothenic_acid: { slug: "PantothenicAcid", dv: 5 },
  choline: { slug: "Choline", dv: 550 },
  calcium: { slug: "Calcium", dv: 1300 },
  iron: { slug: "Iron", dv: 18 },
  magnesium: { slug: "Magnesium", dv: 420 },
  zinc: { slug: "Zinc", dv: 11 },
  selenium: { slug: "Selenium", dv: 55 },
  copper: { slug: "Copper", dv: 0.9 },
  manganese: { slug: "Manganese", dv: 2.3 },
  iodine: { slug: "Iodine", dv: 150 },
  chromium: { slug: "Chromium", dv: 35 },
  molybdenum: { slug: "Molybdenum", dv: 45 },
  potassium: { slug: "Potassium", dv: 4700 },
  phosphorus: { slug: "Phosphorus", dv: 1250 },
  sodium: { slug: "Sodium", dv: 2300 },
};

for (const nutrient of NUTRIENTS) {
  const ref = REFERENCE[nutrient.id];
  if (ref) {
    nutrient.factSheet = `https://ods.od.nih.gov/factsheets/${ref.slug}-HealthProfessional/`;
    nutrient.dailyValue = ref.dv;
  }
}

export const NUTRIENT_BY_ID = new Map(NUTRIENTS.map((n) => [n.id, n]));

/** Guess the labelled form of an ingredient from its name (for conversions). */
export function guessForm(name: string): string | null {
  const t = name.toLowerCase();
  if (t.includes("beta-carotene") || t.includes("beta carotene")) return "beta_carotene";
  if (t.includes("retinyl") || t.includes("retinol")) return "retinol";
  if (t.includes("cholecalciferol") || /\bd3\b/.test(t)) return "d3";
  if (t.includes("ergocalciferol") || /\bd2\b/.test(t)) return "d2";
  if (/\bdl-/.test(t) || t.includes("all-rac")) return "synthetic";
  if (/\bd-alpha\b|\brrr-/.test(t)) return "natural";
  return null;
}

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
