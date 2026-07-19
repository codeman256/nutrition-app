import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { searchDsld } from "@/lib/lookup/dsld";
import { getLnhpdSyncState, searchLnhpd } from "@/lib/lookup/lnhpd";
import type { SearchHit } from "@/lib/lookup/types";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const region = request.nextUrl.searchParams.get("region") === "US" ? "US" : "CA";
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters" }, { status: 400 });
  }

  const syncState = region === "CA" ? await getLnhpdSyncState() : null;
  const lnhpdReady = Boolean(syncState?.syncedAt);

  const [lnhpdHits, dsldHits] = await Promise.all([
    region === "CA" && lnhpdReady
      ? searchLnhpd(q).catch(() => [] as SearchHit[])
      : Promise.resolve([] as SearchHit[]),
    searchDsld(q).catch(() => [] as SearchHit[]),
  ]);

  // Canada-first ordering when the profile region is CA
  const hits = region === "CA" ? [...lnhpdHits, ...dsldHits] : [...dsldHits, ...lnhpdHits];

  return NextResponse.json({
    hits: hits.slice(0, 20),
    lnhpdReady: region === "CA" ? lnhpdReady : null,
  });
}
