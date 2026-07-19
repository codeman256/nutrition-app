/**
 * Open Food Facts barcode lookup — fallback when DSLD doesn't know a UPC.
 * OFF's supplement coverage is spotty on ingredient amounts, so this mostly
 * supplies name/brand/photo; vitamins and minerals are mapped when present.
 */

import { NUTRIENTS } from "@/data/nutrients";
import type { IngredientDraft, ProductDraft } from "./types";

/** OFF nutriment keys → our nutrient ids (per-serving values, unit fields). */
const OFF_KEYS: Record<string, string> = {
  "vitamin-a": "vitamin_a",
  "vitamin-c": "vitamin_c",
  "vitamin-d": "vitamin_d",
  "vitamin-e": "vitamin_e",
  "vitamin-k": "vitamin_k",
  "vitamin-b1": "thiamin",
  "vitamin-b2": "riboflavin",
  "vitamin-pp": "niacin",
  "vitamin-b6": "vitamin_b6",
  "vitamin-b9": "folate",
  "folates": "folate",
  "vitamin-b12": "vitamin_b12",
  "biotin": "biotin",
  "pantothenic-acid": "pantothenic_acid",
  "choline": "choline",
  calcium: "calcium",
  iron: "iron",
  magnesium: "magnesium",
  zinc: "zinc",
  selenium: "selenium",
  copper: "copper",
  manganese: "manganese",
  iodine: "iodine",
  chromium: "chromium",
  molybdenum: "molybdenum",
  potassium: "potassium",
  phosphorus: "phosphorus",
  sodium: "sodium",
};

interface OffProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_front_url?: string;
  nutriments?: Record<string, number | string>;
}

export async function getOffProduct(upc: string): Promise<ProductDraft | null> {
  const code = upc.replace(/\D/g, "");
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,nutriments,image_front_url`;
  const res = await fetch(url, {
    headers: { "User-Agent": "VitaPlan/0.1 (self-hosted supplement planner)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;

  const p = body.product;
  const nutriments = p.nutriments ?? {};
  const ingredients: IngredientDraft[] = [];

  for (const [offKey, nutrientId] of Object.entries(OFF_KEYS)) {
    // prefer per-serving amounts; fall back to per-100g only if serving missing
    const amount = nutriments[`${offKey}_serving`];
    const unit = nutriments[`${offKey}_unit`];
    if (typeof amount !== "number" || amount <= 0 || typeof unit !== "string") {
      continue;
    }
    const def = NUTRIENTS.find((n) => n.id === nutrientId);
    ingredients.push({
      label: def?.name ?? nutrientId,
      nutrientId,
      amountPerServing: amount,
      unit,
      form: null,
    });
  }

  return {
    name: p.product_name || `Product ${code}`,
    brand: p.brands ?? null,
    upc: code,
    servingSize: p.serving_size ?? null,
    imageUrl: p.image_front_url ?? null,
    source: "off",
    ingredients,
  };
}
