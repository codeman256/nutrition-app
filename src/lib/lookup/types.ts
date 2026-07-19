/** A product as imported from an external source, before the user edits it. */
export interface IngredientDraft {
  label: string;
  /** canonical nutrient id, or null when the ingredient isn't tracked */
  nutrientId: string | null;
  amountPerServing: number;
  unit: string;
  form?: string | null;
}

export interface ProductDraft {
  name: string;
  brand?: string | null;
  upc?: string | null;
  npn?: string | null;
  servingSize?: string | null;
  servingsPerContainer?: number | null;
  imageUrl?: string | null;
  source: "dsld" | "off" | "lnhpd" | "ocr" | "manual";
  ingredients: IngredientDraft[];
}

export interface SearchHit {
  source: "dsld" | "lnhpd";
  /** DSLD label id or LNHPD lnhpd_id, as a string */
  sourceId: string;
  name: string;
  brand?: string | null;
  upc?: string | null;
  npn?: string | null;
}
