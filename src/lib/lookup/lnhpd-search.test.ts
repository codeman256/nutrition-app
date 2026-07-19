import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { lnhpdIndex } from "@/db/schema";
import { searchLnhpd } from "./lnhpd";

describe("searchLnhpd", () => {
  beforeAll(async () => {
    await db.delete(lnhpdIndex);
    await db.insert(lnhpdIndex).values([
      {
        lnhpdId: 1,
        licenceNumber: "02242175",
        productName: "Vitamin D 400 IU",
        companyName: "Jamieson Laboratories Ltd./ Nutricorp International",
        dosageForm: "Tablet",
      },
      {
        lnhpdId: 2,
        licenceNumber: "80000436",
        productName: "Vitamin D 1000IU (Tablet)",
        companyName: "Jamieson Laboratories Ltd./ Nutricorp International",
        dosageForm: "Tablet",
      },
      {
        lnhpdId: 3,
        licenceNumber: "80011245",
        productName: "Magnesium Bisglycinate 200",
        companyName: "CanPrev Natural Health Products Ltd.",
        dosageForm: "Capsule",
      },
    ]);
  });

  it("matches brand terms in the company name", async () => {
    const hits = await searchLnhpd("jamieson vitamin d");
    expect(hits.length).toBe(2);
    expect(hits[0].npn).toBeTruthy();
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
});
