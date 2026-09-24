import { randomUUID } from "node:crypto";
import type { CallStore } from "../store/callStore.ts";
import type { CallResult, ConversationOutcome, EndReason } from "../types.ts";
import type { CallRequest, PlacedCall, VoiceProvider } from "./voiceProvider.ts";

export type MockScenario =
  | "confirmed"
  | "declined"
  | "undecided"
  | "off_topic"
  | "asks_if_ai"
  | "parent_answers"
  | "opted_out"
  | "no_answer"
  | "busy"
  | "voicemail"
  | "failed";

const SCENARIOS: MockScenario[] = ["confirmed", "confirmed", "confirmed", "declined", "undecided", "no_answer", "no_answer", "busy", "voicemail", "off_topic", "asks_if_ai", "parent_answers"];

/** Stable scenario per phone number, so repeated runs give the same outcomes. */
export function scenarioForPhone(phone: string, attempt = 1): MockScenario {
  let h = 0;
  for (const ch of phone + ":" + attempt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SCENARIOS[h % SCENARIOS.length]!;
}

type Turn = [role: "agent" | "student", text: string];

function script(s: MockScenario, req: CallRequest): { turns: Turn[]; end: EndReason; report?: { outcome: ConversationOutcome; reason?: string } } {
  const open: Turn = ["agent", req.openingLine];
  const ask: Turn = ["agent", `Congratulations on your admission to ${req.applicant.program}! Will you be taking admission this semester?`];
  switch (s) {
    case "confirmed":
      return { turns: [open, ["student", "Yes, speaking."], ask, ["student", "Yes, I will join."], ["agent", "Wonderful, thank you and welcome!"]], end: "completed", report: { outcome: "confirmed" } };
    case "declined":
      return {
        turns: [open, ["student", "Yes."], ask, ["student", "No, I got admission somewhere else."], ["agent", "Thank you for letting us know. We wish you the best."]],
        end: "completed",
        report: { outcome: "declined", reason: "Admitted to another university" },
      };
    case "undecided":
      return { turns: [open, ["student", "Yes."], ask, ["student", "I haven't decided yet."], ["agent", "No problem, the office may follow up."]], end: "completed", report: { outcome: "undecided" } };
    case "off_topic":
      return {
        turns: [open, ["student", "Who won the match yesterday?"], ["agent", "I'm only able to help with your admission today. Will you be taking admission?"], ["student", "Tell me a joke."], ["agent", "I'll let you go now. The office will contact you again."]],
        end: "completed",
        report: { outcome: "off_topic_limit" },
      };
    case "asks_if_ai":
      return {
        turns: [open, ["student", "Are you a robot?"], ["agent", "Yes, I'm an automated assistant calling on behalf of the admissions office."], ask, ["student", "Okay. Yes, I'll join."]],
        end: "completed",
        report: { outcome: "confirmed" },
      };
    case "parent_answers":
      return {
        turns: [open, ["student", "This is his father."], ask, ["student", "Yes, he will join, insha'Allah."], ["agent", "Thank you!"]],
        end: "completed",
        report: { outcome: "confirmed", reason: "Confirmed by guardian" },
      };
    case "opted_out":
      return { turns: [open, ["student", "Please don't call me again."], ["agent", "Understood, we won't call you again about this."]], end: "completed", report: { outcome: "opted_out" } };
    default:
      return { turns: [], end: s as EndReason };
  }
}

/**
 * Simulated voice provider for development and tests. Places no real calls and costs nothing.
 * The result is delivered through the store on the next tick, like a webhook would.
 */
export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock";

  constructor(
    private readonly store: CallStore,
    private readonly pick: (req: CallRequest) => MockScenario = (req) =>
      scenarioForPhone(req.applicant.phone, Number(req.attemptKey.split(":").pop()) || 1),
  ) {}

  async placeCall(req: CallRequest): Promise<PlacedCall> {
    const providerCallId = `mock-${randomUUID()}`;
    this.store.registerCall(providerCallId, req.attemptKey, req.applicant.id);
    const s = script(this.pick(req), req);
    const startedAt = new Date();
    const durationSec = s.turns.length ? 20 + s.turns.length * 12 : 0;
    const result: CallResult = {
      providerCallId,
      startedAt,
      endedAt: new Date(startedAt.getTime() + (durationSec || 30) * 1000),
      durationSec,
      endReason: s.end,
      detectedLanguage: req.openingLanguage,
      transcript: s.turns.map(([role, text], i) => ({ role, text, at: i * 12 })),
      ...(s.report ? { agentReport: s.report } : {}),
    };
    setImmediate(() => {
      if (s.report) this.store.setAgentReport(providerCallId, s.report);
      this.store.saveResult(providerCallId, result);
    });
    return { providerCallId };
  }
}
