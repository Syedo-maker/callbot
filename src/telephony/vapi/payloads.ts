import { createHash } from "node:crypto";
import type { CampaignConfig, PersonasConfig, VoiceStack } from "../../config.ts";
import { LANGUAGES } from "../../language/languages.ts";
import { campaignVariables, DISCLOSURE_INSTRUCTIONS, fillTemplate, PER_CALL_VARIABLES } from "../../prompts/buildSystemPrompt.ts";
import type { ConversationOutcome } from "../../types.ts";
import type { CallRequest } from "../voiceProvider.ts";

/**
 * Vapi request bodies. Field names follow the public Create Assistant / Create Call APIs
 * (checked against the official VapiAI skills, Sept 2026). Vapi's validation response is
 * the final check — run `npm run vapi:sync -- --dry-run` and then a live sync.
 */

export const RECORDABLE_OUTCOMES: ConversationOutcome[] = [
  "confirmed",
  "declined",
  "undecided",
  "callback_requested",
  "wrong_person",
  "wrong_number",
  "human_requested",
  "opted_out",
  "off_topic_limit",
  "complaint",
  "language_unsupported",
];

export const RECORD_OUTCOME_TOOL_NAME = "record_outcome";

export function recordOutcomeTool(serverUrl: string, credentialId?: string) {
  return {
    type: "function",
    function: {
      name: RECORD_OUTCOME_TOOL_NAME,
      description:
        "Record the result of this admission-confirmation call. Call exactly once, just before your goodbye, after the caller's answer is clear or the call must end.",
      parameters: {
        type: "object",
        properties: {
          outcome: { type: "string", enum: RECORDABLE_OUTCOMES, description: "What the caller decided or why the call is ending." },
          reason: {
            type: "string",
            description: "Short English note: the reason for declining, the callback time, or the complaint. Empty if none.",
          },
        },
        required: ["outcome"],
      },
    },
    server: { url: serverUrl, ...(credentialId ? { credentialId } : {}) },
  };
}

export interface AssistantBuildInput {
  gender: "female" | "male";
  config: CampaignConfig;
  personas: PersonasConfig;
  stack: VoiceStack;
  template: string;
  serverUrl: string;
  /** Vapi custom credential (bearer token) used to authenticate webhooks to our server. */
  serverCredentialId?: string;
}

export function buildAssistantPayload(i: AssistantBuildInput) {
  const persona = i.personas[i.gender];
  const systemPrompt = fillTemplate(i.template, campaignVariables(i.config, { name: persona.name, gender: i.gender }), PER_CALL_VARIABLES);
  const promptVersion = createHash("sha256").update(systemPrompt).digest("hex").slice(0, 12);
  const server = { url: i.serverUrl, ...(i.serverCredentialId ? { credentialId: i.serverCredentialId } : {}) };
  return {
    name: `CallBot ${persona.name} (${i.gender})`,
    firstMessage: "{{opening_line}}",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: i.stack.model.provider,
      model: i.stack.model.model,
      messages: [{ role: "system", content: systemPrompt }],
      tools: [recordOutcomeTool(i.serverUrl, i.serverCredentialId), { type: "endCall" }],
    },
    voice: { ...i.stack.voices[i.gender] },
    transcriber: { ...i.stack.transcriber },
    maxDurationSeconds: i.config.maxDurationSeconds,
    silenceTimeoutSeconds: i.stack.silenceTimeoutSeconds,
    artifactPlan: { recordingEnabled: i.stack.recordingEnabled },
    server,
    serverMessages: ["end-of-call-report", "tool-calls", "status-update"],
    metadata: { app: "callbot", persona: i.gender, promptVersion },
  };
}

export function perCallVariables(req: CallRequest): Record<(typeof PER_CALL_VARIABLES)[number], string> {
  return {
    student_name: req.applicant.name,
    program: req.applicant.program || "your program",
    opening_language_name: LANGUAGES[req.openingLanguage].name,
    opening_line: req.openingLine,
    disclosure_instruction: DISCLOSURE_INSTRUCTIONS[req.disclosure],
  };
}

export interface PhoneRouting {
  pakistan?: string;
  international?: string;
}

/** Pakistani numbers go out through the local SIP trunk (university UAN), everything else through Twilio. */
export function phoneNumberIdFor(country: string, routing: PhoneRouting): string {
  const id = country === "PK" ? routing.pakistan : routing.international;
  if (!id) {
    throw new Error(
      `No Vapi phone number configured for ${country === "PK" ? "Pakistani" : "international"} calls (set ${country === "PK" ? "VAPI_PHONE_NUMBER_ID_PK" : "VAPI_PHONE_NUMBER_ID_INTL"})`,
    );
  }
  return id;
}

export function buildCallPayload(req: CallRequest, assistantId: string, phoneNumberId: string) {
  return {
    assistantId,
    phoneNumberId,
    customer: { number: req.applicant.phone, name: req.applicant.name },
    assistantOverrides: {
      firstMessage: req.openingLine,
      variableValues: perCallVariables(req),
    },
    name: req.attemptKey.slice(0, 40),
  };
}
