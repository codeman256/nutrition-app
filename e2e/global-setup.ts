import fs from "node:fs";
import path from "node:path";

/** Start each e2e run from a clean database. */
export default function globalSetup() {
  const base = path.resolve("./data/e2e.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(base + suffix);
    } catch {
      // not there yet — fine
    }
  }
}
