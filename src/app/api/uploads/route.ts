import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./data/uploads";
const MAX_BYTES = 8 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8 MB)" }, { status: 413 });
  }

  const name = `${randomBytes(12).toString("hex")}${ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(UPLOADS_DIR, name),
    Buffer.from(await file.arrayBuffer()),
  );
  return NextResponse.json({ path: name });
}
