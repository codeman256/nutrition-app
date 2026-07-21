import { matchNutrient } from "@/data/nutrients";
import type { IngredientDraft } from "@/lib/lookup/types";

/**
 * Tidy one OCR'd label name: drop the dot-leader that separates the name from
 * its amount (and any garbage the OCR spilled into it), strip leading noise
 * characters and stray trademark marks, and collapse whitespace.
 */
export function cleanLabel(raw: string): string {
  return (
    raw
      // real ingredient names never contain ".." — cut at the first dot-leader
      .split(/[.·…]{2,}/)[0]
      // …or a spaced leader like ". . . ."
      .split(/(?:[.·…]\s+){2,}/)[0]
      // leading symbols/bullets: "§ ", "* ", "| "
      .replace(/^[^A-Za-z(]+/, "")
      // a stray single-letter token the OCR added before the name: "I Vitamin"
      .replace(/^[A-Za-z]\s+(?=[A-Z(])/, "")
      // trademark / superscript marks and leftover pipes
      .replace(/[™®©℠|_*]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/[\s.,;:]+$/, "")
      .trim()
  );
}

/**
 * Pull ingredient lines out of OCR'd supplement-label text.
 * Looks for "<name> <amount> <unit>" patterns like
 * "Vitamin D3 (as cholecalciferol) 1,000 IU" — good enough to prefill the
 * form; the user reviews every row before saving.
 *
 * Canadian labels repeat everything in French; tracked nutrients are de-duped
 * by nutrient so the same vitamin doesn't import twice.
 */
export function parseLabelText(text: string): IngredientDraft[] {
  const drafts: IngredientDraft[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length < 4) continue;

    const match = line.match(
      /^(.+?)[\s.·…]+([\d,]+(?:\.\d+)?)\s*(mcg|µg|ug|mg|iu|g)\b/i,
    );
    if (!match) continue;

    const label = cleanLabel(match[1]);
    const amount = Number(match[2].replace(/,/g, ""));
    const unit = match[3];
    if (label.length < 3 || !Number.isFinite(amount) || amount <= 0) continue;
    // non-ingredient lines
    if (
      /serving|daily value|calories|container|posologie|directions|store between/i.test(
        label,
      )
    ) {
      continue;
    }

    const nutrientId = matchNutrient(label)?.id ?? null;
    // De-dupe the English/French columns: tracked nutrients by id, the rest by
    // their (cleaned) text.
    const key = nutrientId
      ? `${nutrientId}|${amount}|${unit.toLowerCase()}`
      : `${label.toLowerCase()}|${amount}|${unit.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    drafts.push({
      label,
      nutrientId,
      amountPerServing: amount,
      unit,
      form: null,
    });
  }
  return drafts;
}
