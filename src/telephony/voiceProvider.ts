import type { Persona } from "../persona/persona.ts";
import type { Applicant, LanguageCode } from "../types.ts";

export interface CallRequest {
  /** Deterministic idempotency key: `${campaignId}:${applicantId}:${attempt}`. */
  attemptKey: string;
  applicant: Applicant;
  persona: Persona;
  openingLanguage: LanguageCode;
  openingLine: string;
  disclosure: "on_ask" | "upfront";
}

export interface PlacedCall {
  providerCallId: string;
}

/**
 * A voice platform that can place one outbound AI call. Results arrive asynchronously
 * (webhook for Vapi, immediately for the mock) and are delivered through the CallStore.
 */
export interface VoiceProvider {
  readonly name: string;
  placeCall(req: CallRequest): Promise<PlacedCall>;
}
