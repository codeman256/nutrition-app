import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { lnhpdIndex } from "@/db/schema";
import { LNHPD_COLUMN_COUNT, LNHPD_INSERT_BATCH } from "./lnhpd";

/**
 * Regression cover for "Sync failed: too many SQL variables".
 *
 * SQLite caps a statement at 32,766 bound parameters. A multi-row insert binds
 * one per column per row, so widening lnhpd_index from 5 to 17 columns pushed
 * the old fixed batch of 2,000 rows to 34,000 parameters and every sync died on
 * its first flush. These tests go through the same drizzle insert the sync uses
 * — a per-row prepared statement would not reproduce the failure.
 */
const SQLITE_MAX_VARIABLES = 32_766;

const syntheticRow = (i: number): typeof lnhpdIndex.$inferInsert => ({
  lnhpdId: 900_000 + i,
  productNameId: 900_000 + i,
  licenceNumber: String(80_000_000 + i),
  productName: `Synthetic Product ${i}`,
  companyName: `Synthetic Labs ${i}`,
  companyId: i,
  companyNameId: i,
  dosageForm: "Tablet",
  licenceDate: "2020-01-01",
  revisedDate: "2024-01-01",
  timeReceipt: "2019-01-01",
  dateStart: "2020-01-02",
  subSubmissionTypeCode: 5,
  subSubmissionTypeDesc: "Transitional DIN",
  flagPrimaryName: 1,
  flagProductStatus: 1,
  flagAttestedMonograph: 0,
});

describe("LNHPD index batching", () => {
  it("keeps a full batch under SQLite's bound-parameter cap", () => {
    expect(LNHPD_INSERT_BATCH).toBeGreaterThan(0);
    expect(LNHPD_INSERT_BATCH * LNHPD_COLUMN_COUNT).toBeLessThan(
      SQLITE_MAX_VARIABLES,
    );
  });

  it("tracks the real column count", () => {
    // If this changes, the batch size must still satisfy the check above —
    // which it does automatically, since it is derived from this number.
    expect(LNHPD_COLUMN_COUNT).toBe(17);
  });

  it("inserts a full batch without 'too many SQL variables'", async () => {
    await db.delete(lnhpdIndex);
    const rows = Array.from({ length: LNHPD_INSERT_BATCH }, (_, i) =>
      syntheticRow(i),
    );

    await expect(
      db.insert(lnhpdIndex).values(rows).onConflictDoNothing(),
    ).resolves.toBeDefined();

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(lnhpdIndex);
    expect(n).toBe(LNHPD_INSERT_BATCH);

    await db.delete(lnhpdIndex);
  });
});
