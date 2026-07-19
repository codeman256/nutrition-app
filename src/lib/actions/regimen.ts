"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, regimenItems } from "@/db/schema";
import { requireUser } from "@/lib/session";

export interface RegimenItemUpdate {
  productId: number;
  servingsPerDay: number;
  /** 7-bit mask, bit 0 = Monday */
  daysOfWeek: number;
}

/** Replace the user's whole regimen with the given items. */
export async function saveRegimen(items: RegimenItemUpdate[]) {
  const user = await requireUser();

  const valid = items.filter(
    (item) =>
      Number.isInteger(item.productId) &&
      item.servingsPerDay > 0 &&
      item.servingsPerDay <= 20 &&
      Number.isInteger(item.daysOfWeek) &&
      item.daysOfWeek > 0 &&
      item.daysOfWeek <= 0b1111111,
  );

  // only allow the user's own products
  const owned = valid.length
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.userId, user.id),
            inArray(
              products.id,
              valid.map((v) => v.productId),
            ),
          ),
        )
    : [];
  const ownedIds = new Set(owned.map((o) => o.id));

  await db.delete(regimenItems).where(eq(regimenItems.userId, user.id));
  const rows = valid.filter((v) => ownedIds.has(v.productId));
  if (rows.length > 0) {
    await db.insert(regimenItems).values(
      rows.map((item) => ({
        userId: user.id,
        productId: item.productId,
        servingsPerDay: item.servingsPerDay,
        daysOfWeek: item.daysOfWeek,
      })),
    );
  }

  revalidatePath("/regimen");
  revalidatePath("/dashboard");
  return { ok: true, count: rows.length };
}
