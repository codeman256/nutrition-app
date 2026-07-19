import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/vitaplan.db";

function createDb() {
  fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
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
  return db;
}

// Reuse a single connection across dev hot reloads.
const globalForDb = globalThis as unknown as {
  vitaplanDb?: ReturnType<typeof createDb>;
};

export const db = (globalForDb.vitaplanDb ??= createDb());
export { schema };
