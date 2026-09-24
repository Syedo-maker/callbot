import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cer, editDistance, normalizeText, wer } from "../src/bakeoff/metrics.ts";

describe("bake-off metrics", () => {
  it("computes edit distance", () => {
    expect(editDistance([..."kitten"], [..."sitting"])).toBe(3);
    expect(editDistance([], [..."abc"])).toBe(3);
  });

  it("ignores punctuation, case and Arabic-script spelling variants", () => {
    expect(normalizeText("Yes, I will!")).toBe("yes i will");
    // Arabic yeh/kaf vs Urdu forms, and diacritics, are not errors
    expect(normalizeText("كيا")).toBe(normalizeText("کیا"));
    expect(normalizeText("شُکریہ")).toBe(normalizeText("شکریہ"));
    expect(cer("جی ہاں، میں داخلہ لوں گا۔", "جی ہاں میں داخلہ لوں گا")).toBe(0);
    // Devanagari nukta variants
    expect(normalizeText("फ़ीस")).toBe(normalizeText("फीस"));
  });

  it("scores WER and CER", () => {
    expect(wer("yes i will take admission", "yes i will take admission")).toBe(0);
    expect(wer("yes i will take admission", "yes i will not take admission")).toBeCloseTo(0.2);
    expect(cer("abcd", "abed")).toBeCloseTo(0.25);
    expect(wer("", "")).toBe(0);
  });
});

describe("bake-off phrase set", () => {
  const f = JSON.parse(readFileSync("bakeoff/test-phrases.json", "utf8")) as {
    phrases: { id: string }[];
    translations: Record<string, Record<string, string>>;
  };
  it("covers all 7 launch/pilot languages for every phrase", () => {
    expect(Object.keys(f.translations).sort()).toEqual(["ar", "en", "hi", "pa", "ps", "sd", "ur"]);
    for (const [lang, t] of Object.entries(f.translations)) {
      for (const p of f.phrases) expect(t[p.id], `${lang}/${p.id}`).toBeTruthy();
    }
  });
});
