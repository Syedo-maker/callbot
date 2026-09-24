import type { CampaignConfig, PersonasConfig } from "../config.ts";
import { openingLine } from "../language/openingLines.ts";
import { disclosureMode, selectOpeningLanguage, selectPersona } from "../persona/persona.ts";
import type { Applicant } from "../types.ts";
import type { CallRequest } from "./voiceProvider.ts";

/** Everything decided before dialling: persona, opening language, disclosure mode and the exact first sentence. */
export function prepareCallRequest(applicant: Applicant, attemptKey: string, config: CampaignConfig, personas: PersonasConfig): CallRequest {
  const openingLanguage = selectOpeningLanguage(applicant, config);
  const persona = selectPersona(applicant, personas, config, openingLanguage);
  const disclosure = disclosureMode(applicant, config);
  return {
    attemptKey,
    applicant,
    persona,
    openingLanguage,
    disclosure,
    openingLine: openingLine({
      language: openingLanguage,
      personaGender: persona.gender,
      agentName: persona.spokenName,
      university: config.universityName,
      student: applicant.name,
      upfrontDisclosure: disclosure === "upfront",
    }),
  };
}
