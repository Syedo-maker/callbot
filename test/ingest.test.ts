import { describe, expect, it } from "vitest";
import { auditReport, maskPhone, pkNetwork, summarize } from "../src/ingest/audit.ts";
import { mapHeaders, normalizeGender, normalizePhone, parseDataset, validateRows } from "../src/ingest/parseDataset.ts";
import { normalizeLanguage } from "../src/language/languages.ts";

describe("normalizePhone", () => {
  it.each([
    ["0300-1234567", "+923001234567"],
    ["+92 321 2345678", "+923212345678"],
    ["923331112233", "+923331112233"],
    ["3451234567", "+923451234567"],
    ["0092 300 1234567", "+923001234567"],
    ["3001234567.0", "+923001234567"],
  ])("normalises %s to E.164", (raw, e164) => {
    const r = normalizePhone(raw);
    expect(r.e164).toBe(e164);
    expect(r.issue).toBeUndefined();
  });

  it("flags missing, invalid, landline and international numbers", () => {
    expect(normalizePhone("").issue).toBe("missing");
    expect(normalizePhone("12345").issue).toBe("invalid");
    expect(normalizePhone("042-35761234").issue).toBe("landline");
    const uae = normalizePhone("+971 50 123 4567");
    expect(uae.issue).toBe("international");
    expect(uae.country).toBe("AE");
  });
});

describe("normalizeGender / normalizeLanguage", () => {
  it("recognises common spellings", () => {
    expect(normalizeGender("F")).toBe("female");
    expect(normalizeGender("Male")).toBe("male");
    expect(normalizeGender("خاتون")).toBe("female");
    expect(normalizeGender("X")).toBe("unknown");
    expect(normalizeGender("")).toBeUndefined();
  });
  it("maps language names, codes and native script", () => {
    expect(normalizeLanguage("Urdu")).toBe("ur");
    expect(normalizeLanguage("pushto")).toBe("ps");
    expect(normalizeLanguage("پنجابی")).toBe("pa");
    expect(normalizeLanguage("Klingon")).toBeUndefined();
    expect(normalizeLanguage(" ")).toBeUndefined();
  });
});

describe("mapHeaders", () => {
  it("matches aliases regardless of case and punctuation", () => {
    const { mapping, missing } = mapHeaders(["Application No", "Student Name", "SEX", "Mobile_No", "Programme"]);
    expect(mapping).toMatchObject({ id: "Application No", name: "Student Name", gender: "SEX", phone: "Mobile_No", program: "Programme" });
    expect(missing).toEqual([]);
  });
  it("reports missing required columns", () => {
    expect(mapHeaders(["Name", "Phone"]).missing).toEqual(["gender", "program"]);
  });
});

describe("validateRows", () => {
  it("rejects rows without a name or phone, drops duplicates, keeps extra columns", () => {
    const r = validateRows([
      { Name: "A", Phone: "03001234567", Gender: "F", Program: "BS", City: "Lahore" },
      { Name: "", Phone: "03001234568", Gender: "M", Program: "BS", City: "" },
      { Name: "C", Phone: "abc", Gender: "M", Program: "BS", City: "" },
      { Name: "D", Phone: "+92 300 1234567", Gender: "M", Program: "BS", City: "" },
    ]);
    expect(r.applicants).toHaveLength(1);
    expect(r.applicants[0]).toMatchObject({ id: "row-2", phone: "+923001234567", gender: "female", extra: { City: "Lahore" } });
    expect(r.rejected.map((x) => [x.row, x.field])).toEqual([
      [3, "name"],
      [4, "phone"],
    ]);
    expect(r.duplicates).toEqual([{ row: 5, duplicateOfRow: 2, phone: "+923001234567" }]);
  });
});

describe("sample dataset audit", () => {
  it("produces the expected summary for samples/applicants.sample.csv", async () => {
    const r = await parseDataset("samples/applicants.sample.csv");
    expect(summarize(r)).toEqual({
      totalRows: 20,
      callable: 17,
      rejected: 2,
      duplicates: 1,
      missingGender: 2,
      missingLanguage: 2,
      international: 3,
      landline: 1,
    });
    const md = auditReport(r, "sample", new Date("2026-01-01T00:00:00Z"));
    expect(md).toContain("**Callable applicants** | **17**");
    expect(md).not.toMatch(/\+923001234567/); // phones are masked
  });

  it("masks phones and maps networks", () => {
    expect(maskPhone("+923001234567")).toBe("+9230*****567");
    expect(pkNetwork("+923001234567")).toBe("Jazz");
    expect(pkNetwork("+923451234567")).toBe("Telenor");
    expect(pkNetwork("+924235761234")).toBe("landline / non-mobile");
  });
});
