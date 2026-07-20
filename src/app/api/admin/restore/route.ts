import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/session";
import { restoreFrom } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Replace the live database with an uploaded VitaPlan backup. Admin only. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
  }

  const tmp = path.join(
    os.tmpdir(),
    `vitaplan-restore-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmp, bytes);

    // Validate: it must be a real SQLite file that looks like our schema.
    try {
      const probe = new Database(tmp, { readonly: true });
      try {
        const row = probe
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'",
          )
          .get();
        if (!row) {
          return NextResponse.json(
            { error: "That file isn't a VitaPlan database backup." },
            { status: 400 },
          );
        }
      } finally {
        probe.close();
      }
    } catch {
      return NextResponse.json(
        { error: "That file isn't a valid SQLite database." },
        { status: 400 },
      );
    }

    restoreFrom(tmp);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Restore failed: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 500 },
    );
  } finally {
    try {
      fs.rmSync(tmp);
    } catch {
      // already gone
    }
  }
}
