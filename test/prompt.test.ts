import { describe, expect, it } from "vitest";
import { loadCampaignConfig } from "../src/config.ts";
import { campaignFactsText, campaignVariables, fillTemplate, loadAgentTemplate, PER_CALL_VARIABLES } from "../src/prompts/buildSystemPrompt.ts";

const config = loadCampaignConfig();

describe("system prompt builder", () => {
  it("throws on unfilled placeholders", () => {
    expect(() => fillTemplate("Hi {{name}} from {{place}}", { name: "A" })).toThrow(/place/);
  });

  it("keeps per-call variables for the voice platform and fills everything else", () => {
    const out = fillTemplate(loadAgentTemplate(), campaignVariables(config, { name: "Sara", gender: "female" }), PER_CALL_VARIABLES);
    const left = [...out.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]);
    expect(new Set(left)).toEqual(new Set(PER_CALL_VARIABLES));
    expect(out).toContain("You are Sara");
    expect(out).toContain(config.universityName);
    expect(out).toContain(`at most ${config.maxOffTopicRedirects} times`);
  });

  it("fully fills for a concrete call", () => {
    const vars = {
      ...campaignVariables(config, { name: "Ali", gender: "male" }),
      student_name: "Bilal",
      program: "BBA",
      opening_language_name: "Urdu",
      opening_line: "…",
      disclosure_instruction: "…",
    };
    expect(fillTemplate(loadAgentTemplate(), vars)).not.toMatch(/\{\{/);
  });

  it("describes missing campaign facts safely", () => {
    expect(campaignFactsText([])).toMatch(/office will follow up/);
    expect(campaignFactsText(["Fee deadline: 15 Oct"])).toBe("- Fee deadline: 15 Oct");
  });
});
