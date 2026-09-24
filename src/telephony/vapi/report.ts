import { z } from "zod";
import { normalizeLanguage } from "../../language/languages.ts";
import type { AgentReport, CallResult, EndReason, TranscriptTurn } from "../../types.ts";
import { RECORD_OUTCOME_TOOL_NAME, RECORDABLE_OUTCOMES } from "./payloads.ts";

/** Maps Vapi's `endedReason` (a long, growing list) to our small set. Unknown reasons fall back on whether anyone spoke. */
export function mapEndedReason(reason: string | undefined, studentSpoke: boolean): EndReason {
  const r = (reason ?? "").toLowerCase();
  if (r === "customer-did-not-answer" || r.includes("no-answer")) return "no_answer";
  if (r === "customer-busy" || r.includes("busy")) return "busy";
  if (r.includes("voicemail")) return "voicemail";
  if (r === "exceeded-max-duration") return "time_limit";
  if (["customer-ended-call", "assistant-ended-call", "assistant-said-end-call-phrase", "assistant-ended-call-with-hangup-task"].includes(r)) {
    return studentSpoke ? "completed" : "dropped";
  }
  if (r.includes("silence-timed-out")) return studentSpoke ? "dropped" : "no_answer";
  if (r.includes("failed-to-connect") || r.includes("sip") || r.includes("invalid") || r.includes("unreachable") || r.includes("rejected")) {
    return "failed";
  }
  if (r.includes("error") || r.includes("failed")) return studentSpoke ? "dropped" : "failed";
  return studentSpoke ? "completed" : "failed";
}

export const AgentReportArgs = z.object({
  outcome: z.enum(RECORDABLE_OUTCOMES as [string, ...string[]]),
  reason: z.string().max(500).optional(),
});

export function parseAgentReportArgs(args: unknown): AgentReport | undefined {
  const raw = typeof args === "string" ? safeJson(args) : args;
  const p = AgentReportArgs.safeParse(raw);
  if (!p.success) return undefined;
  const reason = p.data.reason?.trim();
  return { outcome: p.data.outcome as AgentReport["outcome"], ...(reason ? { reason } : {}) };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

interface VapiMessage {
  role?: string;
  message?: string;
  content?: string;
  secondsFromStart?: number;
  toolCalls?: { function?: { name?: string; arguments?: unknown } }[];
}

export interface EndOfCallReport {
  type: "end-of-call-report";
  endedReason?: string;
  call?: { id?: string; startedAt?: string; endedAt?: string };
  artifact?: { messages?: VapiMessage[]; recordingUrl?: string; recording?: { url?: string; mono?: { combinedUrl?: string } }; transcript?: string };
  recordingUrl?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  analysis?: { summary?: string };
}

/** Converts a Vapi end-of-call-report webhook message into our CallResult. */
export function parseEndOfCallReport(m: EndOfCallReport): CallResult {
  const callId = m.call?.id;
  if (!callId) throw new Error("end-of-call-report without call.id");
  const messages = m.artifact?.messages ?? [];

  const transcript: TranscriptTurn[] = [];
  let agentReport: AgentReport | undefined;
  for (const msg of messages) {
    const text = (msg.message ?? msg.content ?? "").trim();
    if ((msg.role === "assistant" || msg.role === "bot") && text) transcript.push({ role: "agent", text, ...(msg.secondsFromStart !== undefined ? { at: msg.secondsFromStart } : {}) });
    else if (msg.role === "user" && text) transcript.push({ role: "student", text, ...(msg.secondsFromStart !== undefined ? { at: msg.secondsFromStart } : {}) });
    for (const tc of msg.toolCalls ?? []) {
      if (tc.function?.name === RECORD_OUTCOME_TOOL_NAME) agentReport ??= parseAgentReportArgs(tc.function.arguments);
    }
  }

  const studentSpoke = transcript.some((t) => t.role === "student");
  const startedAt = new Date(m.startedAt ?? m.call?.startedAt ?? Date.now());
  const endedAt = new Date(m.endedAt ?? m.call?.endedAt ?? startedAt);
  const endReason = mapEndedReason(m.endedReason, studentSpoke);
  const answered = endReason === "completed" || endReason === "dropped" || endReason === "time_limit";
  const durationSec = answered ? Math.max(0, Math.round(m.durationSeconds ?? (endedAt.getTime() - startedAt.getTime()) / 1000)) : 0;
  const recordingUrl = m.artifact?.recordingUrl ?? m.artifact?.recording?.url ?? m.artifact?.recording?.mono?.combinedUrl ?? m.recordingUrl;

  return {
    providerCallId: callId,
    startedAt,
    endedAt,
    durationSec,
    endReason,
    transcript,
    ...(agentReport ? { agentReport } : {}),
    ...(recordingUrl ? { recordingUrl } : {}),
  };
}

/** Best-effort language guess from the student's text script (the classifier sets the final value). */
export function guessLanguageFromScript(text: string): ReturnType<typeof normalizeLanguage> {
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[ڳڃڄڀٻٿڏڌڍڦڇڪ]/.test(text)) return "sd";
  if (/[ښږځڅډړټ]/.test(text)) return "ps";
  if (/[ٹڈڑںےہھ]/.test(text)) return "ur";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[a-z]/i.test(text)) return "en";
  return undefined;
}
