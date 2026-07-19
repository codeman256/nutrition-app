import type { Metadata } from "next";
import { requireConsentedUser } from "@/lib/session";
import { getLnhpdSyncState } from "@/lib/lookup/lnhpd";
import { AddProductFlow } from "@/components/add-product-flow";

export const metadata: Metadata = { title: "Add product" };

export default async function AddProductPage() {
  const { profile } = await requireConsentedUser();
  const syncState = await getLnhpdSyncState();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Add product</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Scan a barcode, search by name or NPN, photograph the label, or type it
        in.
      </p>
      <AddProductFlow
        region={profile.region}
        lnhpdSynced={Boolean(syncState?.syncedAt)}
      />
    </div>
  );
}
