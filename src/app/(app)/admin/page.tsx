import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getLnhpdRowCount, getLnhpdSyncState } from "@/lib/lookup/lnhpd";
import { AdminControls } from "@/components/admin-controls";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [state, indexedCount] = await Promise.all([
    getLnhpdSyncState(),
    getLnhpdRowCount(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Server-wide settings. You see this because you created the first account
        on this VitaPlan server.
      </p>
      <AdminControls
        lnhpd={{
          // An empty table means "never downloaded", whatever the last sync
          // recorded — the two drift apart if the index is cleared.
          syncedAt:
            indexedCount > 0 && state?.syncedAt ? state.syncedAt.getTime() : null,
          recordCount: indexedCount,
          autoSyncDays: state?.autoSyncDays ?? 0,
        }}
      />
    </div>
  );
}
