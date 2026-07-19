import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { searchDsldByUpc, getDsldProduct } from "@/lib/lookup/dsld";
import { getOffProduct } from "@/lib/lookup/off";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = request.nextUrl.searchParams.get("code")?.replace(/\D/g, "");
  if (!code || code.length < 8) {
    return NextResponse.json({ error: "Provide a barcode number" }, { status: 400 });
  }

  // DSLD first (real supplement labels with amounts), then Open Food Facts.
  try {
    const hits = await searchDsldByUpc(code);
    if (hits.length > 0) {
      const draft = await getDsldProduct(hits[0].sourceId);
      return NextResponse.json({ draft });
    }
  } catch {
    // fall through to OFF
  }

  try {
    const draft = await getOffProduct(code);
    if (draft) return NextResponse.json({ draft });
  } catch {
    // fall through to 404
  }

  return NextResponse.json(
    { error: "No product found for that barcode. Try the label photo or manual entry." },
    { status: 404 },
  );
}
