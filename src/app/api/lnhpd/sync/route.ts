import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/session";
import {
  getLnhpdRowCount,
  getLnhpdSyncProgress,
  getLnhpdSyncState,
  setLnhpdAutoSyncDays,
  startLnhpdSync,
} from "@/lib/lookup/lnhpd";

// The dump download takes several minutes but runs in the background now.
export const maxDuration = 60;

async function syncPayload() {
  const state = await getLnhpdSyncState();
  const progress = getLnhpdSyncProgress();
  // What's actually in the table, not what the last sync claimed to write.
  const indexedCount = await getLnhpdRowCount();
  return {
    syncedAt: indexedCount > 0 ? (state?.syncedAt ?? null) : null,
    recordCount: indexedCount,
    autoSyncDays: state?.autoSyncDays ?? 0,
    syncing: progress.running,
    progress: {
      count: progress.count,
      startedAt: progress.startedAt,
      finishedAt: progress.finishedAt,
      error: progress.error,
    },
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await syncPayload());
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Kick off the download in the background and return the current state right
  // away; the client polls GET for progress.
  startLnhpdSync();
  return NextResponse.json({ ok: true, ...(await syncPayload()) });
}

// Admin-only: change how often the index auto-refreshes.
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { autoSyncDays?: unknown } | null;
  const days = Number(body?.autoSyncDays);
  if (!Number.isFinite(days) || days < 0 || days > 3650) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }
  await setLnhpdAutoSyncDays(Math.round(days));
  return NextResponse.json({ ok: true, ...(await syncPayload()) });
}
