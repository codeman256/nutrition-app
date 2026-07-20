import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSession, isAdmin } from "@/lib/session";
import { backupTo } from "@/db";

export const dynamic = "force-dynamic";

/** Download a consistent snapshot of the SQLite database. Admin only. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!(await isAdmin(session.user.id))) {
    return new Response("Admins only", { status: 403 });
  }

  const tmp = path.join(
    os.tmpdir(),
    `vitaplan-backup-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  try {
    await backupTo(tmp);
    const data = fs.readFileSync(tmp);
    const stamp = new Date().toISOString().slice(0, 10);
    // Copy into a fresh ArrayBuffer so the Response body is a plain Uint8Array.
    const body = new Uint8Array(data);
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="vitaplan-${stamp}.db"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      `Backup failed: ${error instanceof Error ? error.message : "unknown"}`,
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
