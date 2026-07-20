import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, regimenItems } from "@/db/schema";
import { requireConsentedUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Regimen — print" };

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtServings(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default async function RegimenPrintPage() {
  const { user } = await requireConsentedUser();

  const [productRows, itemRows] = await Promise.all([
    db.select().from(products).where(eq(products.userId, user.id)),
    db.select().from(regimenItems).where(eq(regimenItems.userId, user.id)),
  ]);
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const rows = itemRows
    .map((item) => {
      const product = productById.get(item.productId);
      if (!product) return null;
      return {
        name: product.name,
        brand: product.brand,
        servingsPerDay: item.servingsPerDay,
        daysOfWeek: item.daysOfWeek,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const printedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Weekly regimen</h1>
          <p className="text-sm text-muted-foreground">
            {user.name} · printed {printedOn}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" className="print:hidden">
            <Link href="/regimen">Back</Link>
          </Button>
          <PrintButton label="Print week" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing scheduled yet. Add products to your regimen first.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Weekly supplement schedule. A number means servings to take that
              day.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b p-2 text-left font-semibold"
                >
                  Product
                </th>
                {DAY_LETTERS.map((letter, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b p-2 text-center font-semibold"
                    title={DAY_NAMES[i]}
                  >
                    <span aria-hidden="true">{letter}</span>
                    <span className="sr-only">{DAY_NAMES[i]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  <td className="border-b p-2 align-top">
                    <div className="font-medium">{row.name}</div>
                    {row.brand && (
                      <div className="text-xs text-muted-foreground">
                        {row.brand}
                      </div>
                    )}
                  </td>
                  {DAY_LETTERS.map((_, day) => {
                    const on = ((row.daysOfWeek >> day) & 1) === 1;
                    return (
                      <td
                        key={day}
                        className="border-b p-2 text-center align-middle tabular-nums"
                      >
                        {on ? (
                          fmtServings(row.servingsPerDay)
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Each number is how many servings to take that day. A dot means none.
          </p>
        </div>
      )}
    </div>
  );
}
