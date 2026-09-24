import type { CampaignConfig, PersonasConfig } from "../config.ts";
import { LANGUAGES } from "../language/languages.ts";
import { hasOpeningLine } from "../language/openingLines.ts";
import type { Applicant, LanguageCode } from "../types.ts";

export interface Persona {
  gender: "female" | "male";
  /** English name used in prompts and logs ("Sara" / "Ali"). */
  name: string;
  /** Name as spoken in the opening line's language. */
  spokenName: string;
}

export function selectPersona(applicant: Applicant, personas: PersonasConfig, config: CampaignConfig, language: LanguageCode): Persona {
  const gender = applicant.gender === "unknown" ? config.defaultPersonaWhenUnknown : applicant.gender;
  const p = personas[gender];
  return { gender, name: p.name, spokenName: p.nameByLanguage[language] ?? p.name };
}

/**
 * Language for the opening line: the applicant's preferred language when we have an approved
 * opening line for it; Urdu for regional languages we can't voice (Saraiki, Balochi, Hindko);
 * otherwise by country. The agent still switches mid-call to whatever the student speaks.
 */
export function selectOpeningLanguage(applicant: Applicant, config: CampaignConfig): LanguageCode {
  const pref = applicant.preferredLanguage;
  if (pref && hasOpeningLine(pref)) return pref;
  if (pref && LANGUAGES[pref].tier === "fallback") return "ur";
  return applicant.country === "PK" ? config.defaultLanguage : config.defaultLanguageInternational;
}

export function disclosureMode(applicant: Applicant, config: CampaignConfig): "on_ask" | "upfront" {
  return config.disclosure.upfrontCountries.includes(applicant.country) ? "upfront" : config.disclosure.default;
}
