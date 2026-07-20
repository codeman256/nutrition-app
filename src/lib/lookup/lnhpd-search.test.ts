import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { lnhpdIndex } from "@/db/schema";
import { searchLnhpd } from "./lnhpd";

/** Fixture rows mirror the dump's shape: one row per marketed name. */
const row = (
  lnhpdId: number,
  productNameId: number,
  licenceNumber: string,
  productName: string,
  companyName: string,
  extra: Partial<typeof lnhpdIndex.$inferInsert> = {},
) => ({
  lnhpdId,
  productNameId,
  licenceNumber,
  productName,
  companyName,
  dosageForm: "Tablet",
  flagPrimaryName: 0,
  flagProductStatus: 1,
  ...extra,
});

describe("searchLnhpd", () => {
  beforeAll(async () => {
    await db.delete(lnhpdIndex);
    await db.insert(lnhpdIndex).values([
      row(1, 10, "02242175", "Vitamin D 400 IU", "Jamieson Laboratories Ltd.", {
        flagPrimaryName: 1,
      }),
      row(2, 20, "80000436", "Vitamin D 1000IU (Tablet)", "Jamieson Laboratories Ltd.", {
        flagPrimaryName: 1,
      }),
      row(3, 30, "80011245", "Magnesium Bisglycinate 200", "CanPrev Natural Health Products Ltd.", {
        flagPrimaryName: 1,
      }),
      // One licence sold under several names, like Health Canada's real data.
      row(4, 40, "01994336", "Vitamin C", "Jamieson Laboratories Ltd.", {
        flagPrimaryName: 1,
      }),
      row(4, 41, "01994336", "Chewable C 500 mg - Natural Tangy Orange", "Jamieson Laboratories Ltd."),
      row(4, 42, "01994336", "Immune Support C", "Jamieson Laboratories Ltd."),
      // A licence with no active name at all.
      row(5, 50, "80099999", "Discontinued Iron Formula", "Old Supplements Inc.", {
        flagPrimaryName: 1,
        flagProductStatus: 0,
      }),
    ]);
  });

  it("matches brand terms in the company name", async () => {
    const hits = await searchLnhpd("jamieson vitamin d");
    expect(hits.length).toBe(2);
    expect(hits[0].npn).toBeTruthy();
  });

  it("does not let a short term match mid-word", async () => {
    // "d" must not match the "d" in "Jamieson Laboratories Ltd.", which would
    // drag the company's Vitamin C licence into a "vitamin d" search.
    const hits = await searchLnhpd("jamieson vitamin d");
    expect(hits.map((h) => h.name)).not.toContain("Vitamin C");
  });

  it("matches by NPN prefix", async () => {
    const hits = await searchLnhpd("80000436");
    expect(hits.map((h) => h.sourceId)).toEqual(["2"]);
  });

  it("matches plain name searches", async () => {
    const hits = await searchLnhpd("magnesium");
    expect(hits.length).toBe(1);
    expect(hits[0].name).toContain("Magnesium");
  });

  it("returns one hit per licence carrying all its names", async () => {
    const hits = await searchLnhpd("immune support");
    expect(hits.length).toBe(1);
    expect(hits[0].sourceId).toBe("4");
    // all three names travel with the hit, not just the matched one
    expect(hits[0].names).toHaveLength(3);
    expect(hits[0].names).toEqual(
      expect.arrayContaining(["Vitamin C", "Immune Support C"]),
    );
  });

  it("leads with the name the user searched for", async () => {
    const hits = await searchLnhpd("immune support");
    expect(hits[0].name).toBe("Immune Support C");
  });

  it("leads with the primary name when nothing matches more closely", async () => {
    const hits = await searchLnhpd("01994336");
    expect(hits[0].name).toBe("Vitamin C");
  });

  it("flags licences with no active name", async () => {
    const active = await searchLnhpd("01994336");
    expect(active[0].discontinued).toBe(false);

    const dead = await searchLnhpd("80099999");
    expect(dead[0].discontinued).toBe(true);
  });
});
