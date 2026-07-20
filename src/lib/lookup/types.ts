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
  /**
   * Every name the source lists for this product. One Health Canada licence
   * often covers several marketed names (flavours, alternate brandings), so
   * the user picks the one printed on their bottle.
   */
  nameOptions?: string[];
  brand?: string | null;
  upc?: string | null;
  npn?: string | null;
  servingSize?: string | null;
  servingsPerContainer?: number | null;
  imageUrl?: string | null;
  pillColor?: string | null;
  source: "dsld" | "off" | "lnhpd" | "ocr" | "manual";
  ingredients: IngredientDraft[];
}

export interface SearchHit {
  source: "dsld" | "lnhpd";
  /** DSLD label id or LNHPD lnhpd_id, as a string */
  sourceId: string;
  name: string;
  /** all names this licence is sold under, best match first */
  names?: string[];
  brand?: string | null;
  upc?: string | null;
  npn?: string | null;
  /** true when no name on the licence is currently active */
  discontinued?: boolean;
}
