import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productIngredients, products, regimenItems } from "@/db/schema";
import { requireConsentedUser } from "@/lib/session";
import {
  weekdayFromDate,
  type DriQuery,
  type ProductInput,
  type RegimenItemInput,
} from "@/lib/planner";
import { DashboardView } from "@/components/dashboard-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export default async function DashboardPage() {
  const { user, profile } = await requireConsentedUser();

  if (!profile.dateOfBirth || !profile.sex) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Fill in your profile first — age and sex pick which recommended
          amounts and limits apply to you.
        </p>
        <Button asChild>
          <Link href="/profile">Complete profile</Link>
        </Button>
      </div>
    );
  }

  const [productRows, ingredientRows, itemRows] = await Promise.all([
    db.select().from(products).where(eq(products.userId, user.id)),
    db
      .select({ ing: productIngredients })
      .from(productIngredients)
      .innerJoin(products, eq(productIngredients.productId, products.id))
      .where(eq(products.userId, user.id)),
    db.select().from(regimenItems).where(eq(regimenItems.userId, user.id)),
  ]);

  const productInputs: ProductInput[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    ingredients: ingredientRows
      .filter((r) => r.ing.productId === p.id)
      .map((r) => ({
        nutrientId: r.ing.nutrientId,
        amountPerServing: r.ing.amountPerServing,
        unit: r.ing.unit,
        form: r.ing.form,
      })),
  }));

  const regimen: RegimenItemInput[] = itemRows.map((item) => ({
    productId: item.productId,
    servingsPerDay: item.servingsPerDay,
    daysOfWeek: item.daysOfWeek,
  }));

  const driProfile: DriQuery = {
    sex: profile.sex,
    age: ageFromDob(profile.dateOfBirth),
    pregnant: profile.pregnant,
    lactating: profile.lactating,
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        What each product adds to your day, against your targets and safe
        limits.
      </p>
      <DashboardView
        products={productInputs}
        regimen={regimen}
        profile={driProfile}
        today={weekdayFromDate(new Date())}
      />
    </div>
  );
}
