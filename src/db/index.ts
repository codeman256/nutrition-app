import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export const databasePath = path.resolve(
  process.env.DATABASE_PATH ?? "./data/vitaplan.db",
);

type Db = ReturnType<typeof drizzle<typeof schema>>;

function createDb(): { db: Db; sqlite: Database.Database } {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Wait instead of failing when several processes (e.g. Next build workers)
  // open the database at the same time.
  sqlite.pragma("busy_timeout = 10000");
  const db = drizzle(sqlite, { schema });

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  }
  return { db, sqlite };
}

// Reuse a single connection across dev hot reloads.
const globalForDb = globalThis as unknown as {
  vitaplanConn?: { db: Db; sqlite: Database.Database };
};

const conn = (globalForDb.vitaplanConn ??= createDb());

/**
 * Exposed as a Proxy so a restore (which swaps `conn.db` for a fresh handle)
 * is transparent to every module that imported `db` — they always reach the
 * live connection instead of a stale snapshot.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const value = conn.db[prop as keyof Db];
    return typeof value === "function" ? value.bind(conn.db) : value;
  },
}) as Db;

export { schema };

/**
 * Write a consistent snapshot of the database to `destPath`.
 * Uses SQLite's online backup so it's safe while the app is running.
 */
export async function backupTo(destPath: string): Promise<void> {
  await conn.sqlite.backup(destPath);
}

/**
 * Replace the live database file with `srcPath` and reopen the connection.
 * The caller must have validated that srcPath is a real VitaPlan database.
 * In-flight requests during the swap may error; acceptable for a single
 * admin restoring their own backup.
 */
export function restoreFrom(srcPath: string): void {
  conn.sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(databasePath + suffix);
    } catch {
      // file may not exist
    }
  }
  fs.copyFileSync(srcPath, databasePath);
  const fresh = createDb();
  conn.db = fresh.db;
  conn.sqlite = fresh.sqlite;
}
