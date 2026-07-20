import type { Metadata } from "next";
import { requireConsentedUser } from "@/lib/session";
import { getLnhpdRowCount } from "@/lib/lookup/lnhpd";
import { AddProductFlow } from "@/components/add-product-flow";

export const metadata: Metadata = { title: "Add product" };

export default async function AddProductPage() {
  const { profile } = await requireConsentedUser();
  // Ask the table, not the last sync's cached count — otherwise an emptied
  // index still hides the "download the database" prompt.
  const indexedCount = await getLnhpdRowCount();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Add product</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Scan a barcode, search by name or NPN, photograph the label, or type it
        in.
      </p>
      <AddProductFlow
        region={profile.region}
        lnhpdSynced={indexedCount > 0}
      />
    </div>
  );
}
