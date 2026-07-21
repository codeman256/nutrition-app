import { describe, expect, it } from "vitest";
import { cleanLabel, parseLabelText } from "./ocr-parse";

describe("cleanLabel", () => {
  it("cuts the dot-leader and its OCR garbage off the name", () => {
    expect(cleanLabel("Vitamin Bs (Niacinamide)...................oovueeenn ov...")).toBe(
      "Vitamin Bs (Niacinamide)",
    );
    expect(cleanLabel("Vitamin B12 (Methylcobalamin) .......................")).toBe(
      "Vitamin B12 (Methylcobalamin)",
    );
  });

  it("drops leading symbols and stray single-letter tokens", () => {
    expect(cleanLabel("§ Vitamin B1 (Thiamine mononitrate)")).toBe(
      "Vitamin B1 (Thiamine mononitrate)",
    );
    expect(cleanLabel("I Vitamin B2 (Riboflavin)")).toBe("Vitamin B2 (Riboflavin)");
  });

  it("strips trademark marks", () => {
    expect(cleanLabel("Vitamin B5 (Pantesin™ Pantethine)")).toBe(
      "Vitamin B5 (Pantesin Pantethine)",
    );
  });
});

describe("parseLabelText", () => {
  it("reads clean supplement lines", () => {
    const rows = parseLabelText(
      "Vitamin D3 (as cholecalciferol) 1,000 IU\nMagnesium (as citrate) 200 mg",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amountPerServing: 1000, unit: "IU", nutrientId: "vitamin_d" });
    expect(rows[1]).toMatchObject({ amountPerServing: 200, unit: "mg" });
  });

  it("de-dupes the English and French columns of a bilingual label", () => {
    // Same nutrient, same amount, once per language — should import once.
    const rows = parseLabelText(
      [
        "Vitamin B1 (Thiamine mononitrate). ........ 100 mg",
        "Vitamine B1 (mononitrate de thiamine). ..... 100 mg",
      ].join("\n"),
    );
    const thiamin = rows.filter((r) => r.nutrientId === "thiamin");
    expect(thiamin).toHaveLength(1);
  });

  it("recovers the readable rows from a real bilingual OCR dump", () => {
    const raw = [
      "Each caplet contains:",
      "§ Vitamin By (Thiamine mononitrate). ....................... 100mg om",
      "Vitamin Bs (Niacinamide)...................oovueeenn ov... 100 mg",
      "Vitamin B12 (Methylcobalamin) ......................... 500 mcg",
      "Chaque caplet contient :",
      "Vitamine By (mononitrate de thiamine). ................ov 100 mg",
    ].join("\n");
    const rows = parseLabelText(raw);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Vitamin By (Thiamine mononitrate)");
    expect(labels).toContain("Vitamin B12 (Methylcobalamin)");
    // no dot-leader garbage survived
    expect(rows.every((r) => !r.label.includes(".."))).toBe(true);
    // thiamin imported once despite appearing in both languages
    expect(rows.filter((r) => r.nutrientId === "thiamin")).toHaveLength(1);
  });
});
