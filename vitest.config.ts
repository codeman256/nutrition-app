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
    // Two test files seed fixtures into lnhpd_index on the same SQLite file, so
    // run files sequentially rather than letting them race each other.
    // Note: these tests wipe lnhpd_index, so `npm test` clears any downloaded
    // LNHPD index in the local dev database — re-sync it from the Admin page.
    fileParallelism: false,
  },
});
