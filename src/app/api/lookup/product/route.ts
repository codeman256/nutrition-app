import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDsldProduct } from "@/lib/lookup/dsld";
import { getLnhpdProduct } from "@/lib/lookup/lnhpd";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const source = request.nextUrl.searchParams.get("source");
  const id = request.nextUrl.searchParams.get("id");
  if (!id || (source !== "dsld" && source !== "lnhpd")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const draft =
      source === "dsld" ? await getDsldProduct(id) : await getLnhpdProduct(id);
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json({ error: "Lookup failed. Try again." }, { status: 502 });
  }
}
