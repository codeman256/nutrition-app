"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productIngredients, products } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { parseUnit } from "@/lib/planner";
import type { IngredientDraft, ProductDraft } from "@/lib/lookup/types";

export interface SaveProductInput extends ProductDraft {
  id?: number;
  imagePath?: string | null;
  notes?: string | null;
}

function validIngredients(ingredients: IngredientDraft[]): IngredientDraft[] {
  return ingredients.filter(
    (ing) =>
      ing.label.trim().length > 0 &&
      Number.isFinite(ing.amountPerServing) &&
      ing.amountPerServing > 0 &&
      parseUnit(ing.unit) !== null,
  );
}

export async function saveProduct(input: SaveProductInput) {
  const user = await requireUser();
  if (!input.name.trim()) return { error: "Give the product a name." };
  const ingredients = validIngredients(input.ingredients);
  if (ingredients.length === 0) {
    return { error: "Add at least one ingredient with an amount and unit." };
  }

  const base = {
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    upc: input.upc?.replace(/\D/g, "") || null,
    npn: input.npn?.trim() || null,
    servingSize: input.servingSize?.trim() || null,
    servingsPerContainer: input.servingsPerContainer ?? null,
    source: input.source,
    imageUrl: input.imageUrl || null,
    imagePath: input.imagePath || null,
    pillColor: input.pillColor || null,
    pillStyle: input.pillStyle || null,
    notes: input.notes?.trim() || null,
    updatedAt: new Date(),
  };

  let productId: number;
  if (input.id) {
    const owned = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.id), eq(products.userId, user.id)))
      .limit(1);
    if (owned.length === 0) return { error: "Product not found." };
    await db.update(products).set(base).where(eq(products.id, input.id));
    await db
      .delete(productIngredients)
      .where(eq(productIngredients.productId, input.id));
    productId = input.id;
  } else {
    const inserted = await db
      .insert(products)
      .values({ ...base, userId: user.id, createdAt: new Date() })
      .returning({ id: products.id });
    productId = inserted[0].id;
  }

  await db.insert(productIngredients).values(
    ingredients.map((ing, index) => ({
      productId,
      nutrientId: ing.nutrientId,
      label: ing.label.trim(),
      amountPerServing: ing.amountPerServing,
      unit: ing.unit,
      form: ing.form ?? null,
      // Keep the order the label (or the user) put them in.
      position: index,
    })),
  );

  revalidatePath("/products");
  revalidatePath("/regimen");
  revalidatePath("/dashboard");
  return { ok: true, id: productId };
}

export async function deleteProduct(id: number) {
  const user = await requireUser();
  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.userId, user.id)));
  revalidatePath("/products");
  revalidatePath("/regimen");
  revalidatePath("/dashboard");
  return { ok: true };
}
