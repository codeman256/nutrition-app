import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productIngredients, products } from "@/db/schema";
import { requireConsentedUser } from "@/lib/session";
import { ProductForm } from "@/components/product-form";
import type { ProductDraft } from "@/lib/lookup/types";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireConsentedUser();
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, user.id)))
    .limit(1);
  const product = productRows[0];
  if (!product) notFound();

  const ingredients = await db
    .select()
    .from(productIngredients)
    .where(eq(productIngredients.productId, productId));

  const draft: ProductDraft = {
    name: product.name,
    brand: product.brand,
    upc: product.upc,
    npn: product.npn,
    servingSize: product.servingSize,
    servingsPerContainer: product.servingsPerContainer,
    imageUrl: product.imageUrl,
    source: product.source,
    ingredients: ingredients.map((ing) => ({
      label: ing.label,
      nutrientId: ing.nutrientId,
      amountPerServing: ing.amountPerServing,
      unit: ing.unit,
      form: ing.form,
    })),
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit product</h1>
      <ProductForm
        draft={draft}
        productId={productId}
        existingImagePath={product.imagePath}
      />
    </div>
  );
}
