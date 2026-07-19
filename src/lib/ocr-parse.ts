import { matchNutrient } from "@/data/nutrients";
import type { IngredientDraft } from "@/lib/lookup/types";

/**
 * Pull ingredient lines out of OCR'd supplement-label text.
 * Looks for "<name> <amount> <unit>" patterns like
 * "Vitamin D3 (as cholecalciferol) 1,000 IU" — good enough to prefill the
 * form; the user reviews every row before saving.
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

    const label = match[1]
      .replace(/[|_*]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const amount = Number(match[2].replace(/,/g, ""));
    const unit = match[3];
    if (!label || !Number.isFinite(amount) || amount <= 0) continue;
    // "Serving size 2 g" and similar non-ingredient lines
    if (/serving|daily value|calories|container/i.test(label)) continue;

    const key = `${label.toLowerCase()}|${amount}|${unit.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    drafts.push({
      label,
      nutrientId: matchNutrient(label)?.id ?? null,
      amountPerServing: amount,
      unit,
      form: null,
    });
  }
  return drafts;
}
