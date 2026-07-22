import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // The LNHPD tests seed and wipe lnhpd_index. Point them at a disposable
    // database so `npm test` never touches the developer's downloaded index.
    // globalSetup deletes this file before and after the run.
    env: { DATABASE_PATH: "./data/vitaplan.test.db" },
    globalSetup: ["./vitest.setup-db.ts"],
    // Two test files seed fixtures into lnhpd_index on the same SQLite file, so
    // run files sequentially rather than letting them race each other.
    fileParallelism: false,
  },
});
