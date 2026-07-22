import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { productIngredients, products, regimenItems } from "@/db/schema";
import { requireConsentedUser } from "@/lib/session";
import { activeDayCount } from "@/lib/planner";
import { dailyServings, projectStock } from "@/lib/stock";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const { user } = await requireConsentedUser();

  const [rows, regimen] = await Promise.all([
    db
      .select({
        product: products,
        ingredient: productIngredients,
      })
      .from(products)
      .leftJoin(productIngredients, eq(productIngredients.productId, products.id))
      .where(eq(products.userId, user.id)),
    db.select().from(regimenItems).where(eq(regimenItems.userId, user.id)),
  ]);

  // Average servings consumed per day for each product in the regimen.
  const perDayByProduct = new Map<number, number>();
  for (const item of regimen) {
    perDayByProduct.set(
      item.productId,
      dailyServings(item.servingsPerDay, activeDayCount(item.daysOfWeek)),
    );
  }

  const byId = new Map<
    number,
    (typeof rows)[number]["product"] & { trackedCount: number; totalCount: number }
  >();
  for (const row of rows) {
    const entry =
      byId.get(row.product.id) ??
      Object.assign(row.product, { trackedCount: 0, totalCount: 0 });
    if (row.ingredient) {
      entry.totalCount++;
      if (row.ingredient.nutrientId) entry.trackedCount++;
    }
    byId.set(row.product.id, entry);
  }
  const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The bottles you have on hand.
          </p>
        </div>
        <Button asChild className="gap-1">
          <Link href="/products/add">
            <Plus className="size-4" aria-hidden="true" /> Add product
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No products yet. Add your first bottle by barcode, search, label
          photo, or manual entry.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const projection = projectStock(
              p.stockServings,
              p.stockUpdatedAt,
              perDayByProduct.get(p.id) ?? 0,
            );
            return (
              <ProductCard
                key={p.id}
                product={{
                  id: p.id,
                  name: p.name,
                  brand: p.brand,
                  servingSize: p.servingSize,
                  imageUrl: p.imageUrl,
                  imagePath: p.imagePath,
                  pillColor: p.pillColor,
                  pillStyle: p.pillStyle,
                  trackedCount: p.trackedCount,
                  totalCount: p.totalCount,
                  daysRemaining: projection?.daysRemaining ?? null,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
