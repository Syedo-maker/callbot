import { describe, expect, it } from "vitest";
import { loadCampaignConfig, loadPersonas } from "../src/config.ts";
import { OPENING_LINES, openingLine } from "../src/language/openingLines.ts";
import { disclosureMode, selectOpeningLanguage, selectPersona } from "../src/persona/persona.ts";
import { prepareCallRequest } from "../src/telephony/prepareCall.ts";
import type { Applicant } from "../src/types.ts";

const config = loadCampaignConfig();
const personas = loadPersonas();
const a = (over: Partial<Applicant> = {}): Applicant => ({
  id: "1",
  name: "Ayesha Khan",
  gender: "female",
  phone: "+923001234567",
  country: "PK",
  program: "BS CS",
  extra: {},
  ...over,
});

describe("persona selection", () => {
  it("matches persona to gender, with the configured default for unknown", () => {
    expect(selectPersona(a(), personas, config, "en").name).toBe("Sara");
    expect(selectPersona(a({ gender: "male" }), personas, config, "en").name).toBe("Ali");
    expect(selectPersona(a({ gender: "unknown" }), personas, config, "en").gender).toBe(config.defaultPersonaWhenUnknown);
    expect(selectPersona(a(), personas, config, "ur").spokenName).toBe("سارہ");
  });

  it("chooses the opening language from preference, tier and country", () => {
    expect(selectOpeningLanguage(a({ preferredLanguage: "ps" }), config)).toBe("ps");
    expect(selectOpeningLanguage(a({ preferredLanguage: "skr" }), config)).toBe("ur"); // Saraiki → Urdu fallback
    expect(selectOpeningLanguage(a(), config)).toBe("ur");
    expect(selectOpeningLanguage(a({ country: "AE", phone: "+971501234567" }), config)).toBe("en");
  });

  it("uses upfront AI disclosure for EU/UK/US numbers only", () => {
    expect(disclosureMode(a(), config)).toBe("on_ask");
    expect(disclosureMode(a({ country: "GB" }), config)).toBe("upfront");
    expect(disclosureMode(a({ country: "DE" }), config)).toBe("upfront");
    expect(disclosureMode(a({ country: "SA" }), config)).toBe("on_ask");
  });
});

describe("opening lines", () => {
  it("exist for all 7 launch/pilot languages", () => {
    expect(Object.keys(OPENING_LINES).sort()).toEqual(["ar", "en", "hi", "pa", "ps", "sd", "ur"]);
  });

  it("use gendered verb forms where the language requires them", () => {
    const base = { agentName: "X", university: "U", student: "S", upfrontDisclosure: false };
    expect(openingLine({ ...base, language: "ur", personaGender: "female" })).toContain("رہی ہوں");
    expect(openingLine({ ...base, language: "ur", personaGender: "male" })).toContain("رہا ہوں");
    expect(openingLine({ ...base, language: "hi", personaGender: "female" })).toContain("रही हूँ");
    expect(openingLine({ ...base, language: "sd", personaGender: "male" })).toContain("رهيو آهيان");
  });

  it("always contain the recording notice, and the AI disclosure only when upfront", () => {
    const base = { language: "en" as const, personaGender: "female" as const, agentName: "Sara", university: "Example University", student: "Ayesha" };
    const onAsk = openingLine({ ...base, upfrontDisclosure: false });
    const upfront = openingLine({ ...base, upfrontDisclosure: true });
    expect(onAsk).toBe(
      "Assalam-o-Alaikum, this is Sara from the admissions office at Example University. This call is recorded for quality purposes. Am I speaking with Ayesha?",
    );
    expect(onAsk).not.toContain("automated");
    expect(upfront).toContain("automated assistant");
    for (const lang of Object.keys(OPENING_LINES) as (keyof typeof OPENING_LINES)[]) {
      const line = openingLine({ ...base, language: lang, upfrontDisclosure: false });
      expect(line, lang).toContain(OPENING_LINES[lang]!.notice);
      expect(line).not.toMatch(/\{(agent|university|student)\}/);
    }
  });
});

describe("prepareCallRequest", () => {
  it("builds a complete request", () => {
    const r = prepareCallRequest(a({ gender: "male", preferredLanguage: "pa" }), "c:1:1", config, personas);
    expect(r.persona.name).toBe("Ali");
    expect(r.openingLanguage).toBe("pa");
    expect(r.openingLine).toContain("علی");
    expect(r.openingLine).toContain(config.universityName);
    expect(r.openingLine).toContain("Ayesha Khan");
  });
});
