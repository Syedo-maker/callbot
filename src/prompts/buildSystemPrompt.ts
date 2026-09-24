import { readFileSync } from "node:fs";
import type { CampaignConfig } from "../config.ts";

export const AGENT_PROMPT_PATH = "prompts/agent-system-prompt.md";

/** Variables that change per call. On Vapi they stay as {{placeholders}} and are filled by `variableValues`. */
export const PER_CALL_VARIABLES = ["student_name", "program", "opening_language_name", "opening_line", "disclosure_instruction"] as const;
export type PerCallVariable = (typeof PER_CALL_VARIABLES)[number];

export const DISCLOSURE_INSTRUCTIONS = {
  on_ask: "Do not bring up that you are an automated assistant unless the caller asks.",
  upfront:
    "You have already told the caller in the opening line that you are an automated assistant calling from the admissions office. Do not repeat it unless asked.",
} as const;

export function campaignFactsText(facts: string[]): string {
  return facts.length
    ? facts.map((f) => `- ${f}`).join("\n")
    : "No campaign facts have been provided. For any factual question, say the admissions office will follow up.";
}

export function campaignVariables(config: CampaignConfig, persona: { name: string; gender: "female" | "male" }): Record<string, string> {
  return {
    persona_name: persona.name,
    persona_gender: persona.gender,
    university_name: config.universityName,
    max_redirects: String(config.maxOffTopicRedirects),
    soft_limit_seconds: String(config.softLimitSeconds),
    campaign_facts: campaignFactsText(config.facts),
  };
}

/**
 * Fills {{variables}} in the agent prompt template. Names listed in `keep` are left as
 * {{name}} for the voice platform to fill per call; any other unfilled placeholder throws,
 * so a broken prompt can never reach a real call.
 */
export function fillTemplate(template: string, vars: Record<string, string>, keep: readonly string[] = []): string {
  const missing = new Set<string>();
  const out = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, name: string) => {
    if (name in vars) return vars[name]!;
    if (keep.includes(name)) return m;
    missing.add(name);
    return m;
  });
  if (missing.size) throw new Error(`Unfilled prompt variables: ${[...missing].join(", ")}`);
  return out;
}

export function loadAgentTemplate(path = AGENT_PROMPT_PATH): string {
  return readFileSync(path, "utf8");
}
