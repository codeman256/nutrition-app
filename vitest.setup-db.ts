import fs from "node:fs";
import path from "node:path";

/**
 * Global setup: keep the test suite off the developer's database.
 *
 * The LNHPD tests seed and wipe `lnhpd_index`. Pointed at the default
 * `./data/vitaplan.db`, `npm test` would clear the developer's downloaded
 * ~300k-row Health Canada index, forcing a slow re-sync after every run. The
 * config sets `DATABASE_PATH` to a disposable file for the workers; here we
 * make sure it starts and ends clean. Keep this path in sync with `test.env`.
 */
const testDbPath = path.resolve("./data/vitaplan.test.db");

function removeDbFiles() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(testDbPath + suffix);
    } catch {
      // file may not exist
    }
  }
}

export function setup() {
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  removeDbFiles();
}

export function teardown() {
  removeDbFiles();
}
