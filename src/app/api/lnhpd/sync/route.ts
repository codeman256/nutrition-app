import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLnhpdSyncState, syncLnhpdIndex } from "@/lib/lookup/lnhpd";

// The dump download takes several minutes.
export const maxDuration = 1800;

let syncInFlight: Promise<{ recordCount: number }> | null = null;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getLnhpdSyncState();
  return NextResponse.json({
    syncedAt: state?.syncedAt ?? null,
    recordCount: state?.recordCount ?? null,
    syncing: syncInFlight !== null,
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!syncInFlight) {
    syncInFlight = syncLnhpdIndex().finally(() => {
      syncInFlight = null;
    });
  }

  try {
    const result = await syncInFlight;
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: `Sync failed: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 502 },
    );
  }
}
