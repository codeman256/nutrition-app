import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./data/uploads";
const TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  // uploads are always hex names we generated; reject anything else
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(UPLOADS_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPE_BY_EXT[path.extname(name)] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
