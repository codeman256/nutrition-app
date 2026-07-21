import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, regimenItems } from "@/db/schema";
import { requireConsentedUser } from "@/lib/session";
import { EVERY_DAY } from "@/lib/planner";
import { RegimenEditor, type RegimenProductRow } from "@/components/regimen-editor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Regimen" };

export default async function RegimenPage() {
  const { user } = await requireConsentedUser();

  const [productRows, itemRows] = await Promise.all([
    db.select().from(products).where(eq(products.userId, user.id)),
    db.select().from(regimenItems).where(eq(regimenItems.userId, user.id)),
  ]);
  const itemByProduct = new Map(itemRows.map((item) => [item.productId, item]));

  const rows: RegimenProductRow[] = productRows
    .map((p) => {
      const item = itemByProduct.get(p.id);
      return {
        productId: p.id,
        name: p.name,
        brand: p.brand,
        servingSize: p.servingSize,
        imageSrc: p.imagePath ? `/api/uploads/${p.imagePath}` : p.imageUrl,
        pillColor: p.pillColor,
        pillStyle: p.pillStyle,
        servingsPerDay: item?.servingsPerDay ?? null,
        daysOfWeek: item?.daysOfWeek ?? EVERY_DAY,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My Regimen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what you take, how many servings, and on which days of the
            week. When you enable a product it starts on{" "}
            <strong>every day</strong> — highlighted day circles are on; tap one
            to skip that day.
          </p>
        </div>
        {rows.some((r) => r.servingsPerDay !== null) && (
          <Button asChild variant="outline" className="shrink-0 gap-2">
            <Link href="/regimen/print">
              <Printer className="size-4" aria-hidden="true" /> Print week
            </Link>
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p className="text-sm text-muted-foreground">
            Add some products first, then build your weekly schedule here.
          </p>
          <Button asChild>
            <Link href="/products/add">Add a product</Link>
          </Button>
        </div>
      ) : (
        <RegimenEditor initial={rows} />
      )}
    </div>
  );
}
