/**
 * Dietary Reference Intakes (DRI) — RDA/AI and Tolerable Upper Intake Levels
 * (UL) by life-stage group, transcribed from the NIH Office of Dietary
 * Supplements / NASEM summary tables (https://ods.od.nih.gov).
 *
 * Values are in each nutrient's canonical unit from `nutrients.ts`
 * (mcg for vitamin D — not IU; mg alpha-tocopherol for vitamin E; mcg RAE for
 * vitamin A; mcg DFE for folate; mg NE for niacin).
 *
 * Notes:
 * - `isAI` marks Adequate Intake values (no RDA established).
 * - `ul: null` means no UL has been established. Several ULs apply to the
 *   supplemental form only (magnesium, niacin, folate, vitamin E) — exactly
 *   what this app tracks.
 * - Sodium's "ul" is the Chronic Disease Risk Reduction (CDRR) intake.
 */

export type Sex = "male" | "female";

export interface DriQuery {
  sex: Sex;
  /** age in whole years */
  age: number;
  pregnant?: boolean;
  lactating?: boolean;
}

interface DriRow {
  /** 'M' | 'F' | 'B' (both) */
  sex: "M" | "F" | "B";
  /** 'n' normal, 'p' pregnancy, 'l' lactation */
  stage: "n" | "p" | "l";
  minAge: number;
  maxAge: number; // inclusive
  value: number | null; // RDA or AI
  isAI?: boolean;
  ul: number | null;
}

/** rows are evaluated top-to-bottom; first match wins */
const DRI_TABLE: Record<string, DriRow[]> = {
  vitamin_a: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 750, ul: 2800 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 770, ul: 3000 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 1200, ul: 2800 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 1300, ul: 3000 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 300, ul: 600 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 400, ul: 900 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 600, ul: 1700 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 900, ul: 2800 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 700, ul: 2800 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 900, ul: 3000 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 700, ul: 3000 },
  ],
  vitamin_c: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 80, ul: 1800 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 85, ul: 2000 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 115, ul: 1800 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 120, ul: 2000 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 15, ul: 400 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 25, ul: 650 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 45, ul: 1200 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 75, ul: 1800 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 65, ul: 1800 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 90, ul: 2000 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 75, ul: 2000 },
  ],
  vitamin_d: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 15, ul: 100 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 15, ul: 100 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 15, ul: 63 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 15, ul: 75 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 70, value: 15, ul: 100 },
    { sex: "B", stage: "n", minAge: 71, maxAge: 120, value: 20, ul: 100 },
  ],
  vitamin_e: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 15, ul: 800 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 15, ul: 1000 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 19, ul: 800 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 19, ul: 1000 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 6, ul: 200 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 7, ul: 300 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 11, ul: 600 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 15, ul: 800 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 120, value: 15, ul: 1000 },
  ],
  vitamin_k: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 75, isAI: true, ul: null },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 90, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 75, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 90, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 30, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 55, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 60, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 75, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 120, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 90, isAI: true, ul: null },
  ],
  thiamin: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 1.4, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 1.4, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 0.5, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 0.6, ul: null },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 0.9, ul: null },
    { sex: "M", stage: "n", minAge: 14, maxAge: 120, value: 1.2, ul: null },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 1.0, ul: null },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 1.1, ul: null },
  ],
  riboflavin: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 1.4, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 1.6, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 0.5, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 0.6, ul: null },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 0.9, ul: null },
    { sex: "M", stage: "n", minAge: 14, maxAge: 120, value: 1.3, ul: null },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 1.0, ul: null },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 1.1, ul: null },
  ],
  niacin: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 18, ul: 30 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 18, ul: 35 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 17, ul: 30 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 17, ul: 35 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 6, ul: 10 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 8, ul: 15 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 12, ul: 20 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 16, ul: 30 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 14, ul: 30 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 16, ul: 35 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 14, ul: 35 },
  ],
  vitamin_b6: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 1.9, ul: 80 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 1.9, ul: 100 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 2.0, ul: 80 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 2.0, ul: 100 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 0.5, ul: 30 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 0.6, ul: 40 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 1.0, ul: 60 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 1.3, ul: 80 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 1.2, ul: 80 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 50, value: 1.3, ul: 100 },
    { sex: "M", stage: "n", minAge: 51, maxAge: 120, value: 1.7, ul: 100 },
    { sex: "F", stage: "n", minAge: 51, maxAge: 120, value: 1.5, ul: 100 },
  ],
  folate: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 600, ul: 800 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 600, ul: 1000 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 500, ul: 800 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 500, ul: 1000 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 150, ul: 300 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 200, ul: 400 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 300, ul: 600 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 400, ul: 800 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 120, value: 400, ul: 1000 },
  ],
  vitamin_b12: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 2.6, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 2.8, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 0.9, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 1.2, ul: null },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 1.8, ul: null },
    { sex: "B", stage: "n", minAge: 14, maxAge: 120, value: 2.4, ul: null },
  ],
  biotin: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 30, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 35, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 8, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 12, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 20, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 25, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 19, maxAge: 120, value: 30, isAI: true, ul: null },
  ],
  pantothenic_acid: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 6, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 7, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 2, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 3, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 4, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 14, maxAge: 120, value: 5, isAI: true, ul: null },
  ],
  choline: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 450, isAI: true, ul: 3000 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 450, isAI: true, ul: 3500 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 550, isAI: true, ul: 3000 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 550, isAI: true, ul: 3500 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 200, isAI: true, ul: 1000 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 250, isAI: true, ul: 1000 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 375, isAI: true, ul: 2000 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 550, isAI: true, ul: 3000 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 400, isAI: true, ul: 3000 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 550, isAI: true, ul: 3500 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 425, isAI: true, ul: 3500 },
  ],
  calcium: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 1300, ul: 3000 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 1000, ul: 2500 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 1300, ul: 3000 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 1000, ul: 2500 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 700, ul: 2500 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 1000, ul: 2500 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 18, value: 1300, ul: 3000 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 50, value: 1000, ul: 2500 },
    { sex: "M", stage: "n", minAge: 51, maxAge: 70, value: 1000, ul: 2000 },
    { sex: "F", stage: "n", minAge: 51, maxAge: 70, value: 1200, ul: 2000 },
    { sex: "B", stage: "n", minAge: 71, maxAge: 120, value: 1200, ul: 2000 },
  ],
  iron: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 27, ul: 45 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 10, ul: 45 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 9, ul: 45 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 7, ul: 40 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 10, ul: 40 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 8, ul: 40 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 11, ul: 45 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 15, ul: 45 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 8, ul: 45 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 50, value: 18, ul: 45 },
    { sex: "F", stage: "n", minAge: 51, maxAge: 120, value: 8, ul: 45 },
  ],
  magnesium: [
    // UL applies to supplemental magnesium only
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 400, ul: 350 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 30, value: 350, ul: 350 },
    { sex: "B", stage: "p", minAge: 31, maxAge: 120, value: 360, ul: 350 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 360, ul: 350 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 30, value: 310, ul: 350 },
    { sex: "B", stage: "l", minAge: 31, maxAge: 120, value: 320, ul: 350 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 80, ul: 65 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 130, ul: 110 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 240, ul: 350 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 410, ul: 350 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 360, ul: 350 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 30, value: 400, ul: 350 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 30, value: 310, ul: 350 },
    { sex: "M", stage: "n", minAge: 31, maxAge: 120, value: 420, ul: 350 },
    { sex: "F", stage: "n", minAge: 31, maxAge: 120, value: 320, ul: 350 },
  ],
  zinc: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 12, ul: 34 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 11, ul: 40 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 13, ul: 34 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 12, ul: 40 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 3, ul: 7 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 5, ul: 12 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 8, ul: 23 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 11, ul: 34 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 9, ul: 34 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 11, ul: 40 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 8, ul: 40 },
  ],
  selenium: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 60, ul: 400 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 70, ul: 400 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 20, ul: 90 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 30, ul: 150 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 40, ul: 280 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 120, value: 55, ul: 400 },
  ],
  copper: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 1.0, ul: 8 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 1.0, ul: 10 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 1.3, ul: 8 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 1.3, ul: 10 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 0.34, ul: 1 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 0.44, ul: 3 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 0.7, ul: 5 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 0.89, ul: 8 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 120, value: 0.9, ul: 10 },
  ],
  manganese: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 2.0, isAI: true, ul: 9 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 2.0, isAI: true, ul: 11 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 2.6, isAI: true, ul: 9 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 2.6, isAI: true, ul: 11 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 1.2, isAI: true, ul: 2 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 1.5, isAI: true, ul: 3 },
    { sex: "M", stage: "n", minAge: 9, maxAge: 13, value: 1.9, isAI: true, ul: 6 },
    { sex: "F", stage: "n", minAge: 9, maxAge: 13, value: 1.6, isAI: true, ul: 6 },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 2.2, isAI: true, ul: 9 },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 1.6, isAI: true, ul: 9 },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 2.3, isAI: true, ul: 11 },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 1.8, isAI: true, ul: 11 },
  ],
  iodine: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 220, ul: 900 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 220, ul: 1100 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 290, ul: 900 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 290, ul: 1100 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 90, ul: 200 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 90, ul: 300 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 120, ul: 600 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 150, ul: 900 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 120, value: 150, ul: 1100 },
  ],
  chromium: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 29, isAI: true, ul: null },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 30, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 44, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 45, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 11, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 15, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 9, maxAge: 13, value: 25, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 9, maxAge: 13, value: 21, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 14, maxAge: 50, value: 35, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 24, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 19, maxAge: 50, value: 25, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 51, maxAge: 120, value: 30, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 51, maxAge: 120, value: 20, isAI: true, ul: null },
  ],
  molybdenum: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 50, ul: 1700 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 50, ul: 2000 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 50, ul: 1700 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 50, ul: 2000 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 17, ul: 300 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 22, ul: 600 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 34, ul: 1100 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 18, value: 43, ul: 1700 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 120, value: 45, ul: 2000 },
  ],
  potassium: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 2600, isAI: true, ul: null },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 2900, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 2500, isAI: true, ul: null },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 2800, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 2000, isAI: true, ul: null },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 2300, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 9, maxAge: 13, value: 2500, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 9, maxAge: 13, value: 2300, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 14, maxAge: 18, value: 3000, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 14, maxAge: 18, value: 2300, isAI: true, ul: null },
    { sex: "M", stage: "n", minAge: 19, maxAge: 120, value: 3400, isAI: true, ul: null },
    { sex: "F", stage: "n", minAge: 19, maxAge: 120, value: 2600, isAI: true, ul: null },
  ],
  phosphorus: [
    { sex: "B", stage: "p", minAge: 14, maxAge: 18, value: 1250, ul: 3500 },
    { sex: "B", stage: "p", minAge: 19, maxAge: 120, value: 700, ul: 3500 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 18, value: 1250, ul: 4000 },
    { sex: "B", stage: "l", minAge: 19, maxAge: 120, value: 700, ul: 4000 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 460, ul: 3000 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 500, ul: 3000 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 18, value: 1250, ul: 4000 },
    { sex: "B", stage: "n", minAge: 19, maxAge: 70, value: 700, ul: 4000 },
    { sex: "B", stage: "n", minAge: 71, maxAge: 120, value: 700, ul: 3000 },
  ],
  sodium: [
    // "ul" here is the CDRR (Chronic Disease Risk Reduction) intake
    { sex: "B", stage: "p", minAge: 14, maxAge: 120, value: 1500, isAI: true, ul: 2300 },
    { sex: "B", stage: "l", minAge: 14, maxAge: 120, value: 1500, isAI: true, ul: 2300 },
    { sex: "B", stage: "n", minAge: 1, maxAge: 3, value: 800, isAI: true, ul: 1200 },
    { sex: "B", stage: "n", minAge: 4, maxAge: 8, value: 1000, isAI: true, ul: 1500 },
    { sex: "B", stage: "n", minAge: 9, maxAge: 13, value: 1200, isAI: true, ul: 1800 },
    { sex: "B", stage: "n", minAge: 14, maxAge: 120, value: 1500, isAI: true, ul: 2300 },
  ],
};

export interface DriValues {
  /** RDA, or AI when `isAI` is true; null if not established for this group */
  recommended: number | null;
  isAI: boolean;
  /** Tolerable Upper Intake Level; null if none established */
  ul: number | null;
}

export function getDri(nutrientId: string, query: DriQuery): DriValues {
  const rows = DRI_TABLE[nutrientId];
  if (!rows) return { recommended: null, isAI: false, ul: null };

  const stage = query.pregnant ? "p" : query.lactating ? "l" : "n";
  const sexKey = query.sex === "male" ? "M" : "F";

  for (const row of rows) {
    if (row.stage !== stage) continue;
    if (row.sex !== "B" && row.sex !== sexKey) continue;
    if (query.age < row.minAge || query.age > row.maxAge) continue;
    return {
      recommended: row.value,
      isAI: row.isAI ?? false,
      ul: row.ul,
    };
  }
  // pregnancy/lactation rows only exist for 14+; fall back to normal rows
  if (stage !== "n") {
    return getDri(nutrientId, { ...query, pregnant: false, lactating: false });
  }
  return { recommended: null, isAI: false, ul: null };
}
