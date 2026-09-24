import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { loadCampaignConfig, loadPersonas, loadVoiceStack } from "../src/config.ts";
import { loadAgentTemplate } from "../src/prompts/buildSystemPrompt.ts";
import { CallStore } from "../src/store/callStore.ts";
import { prepareCallRequest } from "../src/telephony/prepareCall.ts";
import { buildAssistantPayload, buildCallPayload, phoneNumberIdFor } from "../src/telephony/vapi/payloads.ts";
import { guessLanguageFromScript, mapEndedReason, parseEndOfCallReport } from "../src/telephony/vapi/report.ts";
import { createWebhookServer } from "../src/telephony/vapi/webhookServer.ts";
import type { Applicant } from "../src/types.ts";

const config = loadCampaignConfig();
const personas = loadPersonas();
const stack = loadVoiceStack();
const applicant: Applicant = { id: "7", name: "Ayesha", gender: "female", phone: "+923001234567", country: "PK", program: "BS CS", extra: {} };

describe("Vapi payloads", () => {
  it("builds an assistant with prompt, tools, limits and webhook", () => {
    const p = buildAssistantPayload({ gender: "male", config, personas, stack, template: loadAgentTemplate(), serverUrl: "https://x.test/vapi/webhook", serverCredentialId: "cred-1" });
    expect(p.name).toBe("CallBot Ali (male)");
    expect(p.firstMessage).toBe("{{opening_line}}");
    expect(p.maxDurationSeconds).toBe(config.maxDurationSeconds);
    expect(p.model.messages[0]!.content).toContain("You are Ali");
    expect(p.model.messages[0]!.content).toContain("{{student_name}}");
    expect(p.model.tools.map((t) => t.type)).toEqual(["function", "endCall"]);
    expect(p.server).toEqual({ url: "https://x.test/vapi/webhook", credentialId: "cred-1" });
    expect(p.serverMessages).toContain("end-of-call-report");
    expect(p.metadata.promptVersion).toMatch(/^[0-9a-f]{12}$/);
  });

  it("builds a call with per-call variables and routes by country", () => {
    const req = prepareCallRequest(applicant, "camp:7:1", config, personas);
    const routing = { pakistan: "pn-pk", international: "pn-intl" };
    const p = buildCallPayload(req, "asst-f", phoneNumberIdFor("PK", routing));
    expect(p).toMatchObject({ assistantId: "asst-f", phoneNumberId: "pn-pk", customer: { number: "+923001234567", name: "Ayesha" } });
    expect(p.assistantOverrides.firstMessage).toBe(req.openingLine);
    expect(p.assistantOverrides.variableValues).toMatchObject({ student_name: "Ayesha", program: "BS CS", opening_language_name: "Urdu" });
    expect(phoneNumberIdFor("AE", routing)).toBe("pn-intl");
    expect(() => phoneNumberIdFor("PK", {})).toThrow(/VAPI_PHONE_NUMBER_ID_PK/);
  });
});

describe("end-of-call report", () => {
  it("maps ended reasons", () => {
    expect(mapEndedReason("customer-did-not-answer", false)).toBe("no_answer");
    expect(mapEndedReason("customer-busy", false)).toBe("busy");
    expect(mapEndedReason("voicemail", false)).toBe("voicemail");
    expect(mapEndedReason("exceeded-max-duration", true)).toBe("time_limit");
    expect(mapEndedReason("assistant-ended-call", true)).toBe("completed");
    expect(mapEndedReason("customer-ended-call", false)).toBe("dropped");
    expect(mapEndedReason("twilio-failed-to-connect-call", false)).toBe("failed");
    expect(mapEndedReason("pipeline-error-something", true)).toBe("dropped");
  });

  it("parses transcript, agent outcome, recording and duration", () => {
    const r = parseEndOfCallReport(fixtureReport());
    expect(r.providerCallId).toBe("call-123");
    expect(r.endReason).toBe("completed");
    expect(r.durationSec).toBe(74);
    expect(r.transcript.map((t) => t.role)).toEqual(["agent", "student", "agent", "student"]);
    expect(r.agentReport).toEqual({ outcome: "declined", reason: "Admitted elsewhere" });
    expect(r.recordingUrl).toBe("https://storage.test/rec.wav");
  });

  it("guesses language from script", () => {
    expect(guessLanguageFromScript("نہیں، میں داخلہ نہیں لوں گی")).toBe("ur");
    expect(guessLanguageFromScript("ما ته څو ورځې په کار دي")).toBe("ps");
    expect(guessLanguageFromScript("مون کي ڪجهه ڏينهن گهرجن")).toBe("sd");
    expect(guessLanguageFromScript("नहीं")).toBe("hi");
    expect(guessLanguageFromScript("yes I will")).toBe("en");
  });
});

describe("webhook server", () => {
  const TOKEN = "test-token-0123456789";
  let server: ReturnType<typeof createWebhookServer> | undefined;
  afterEach(() => server?.close());

  async function start(store: CallStore) {
    server = createWebhookServer({ store, bearerToken: TOKEN });
    await new Promise<void>((r) => server!.listen(0, r));
    const port = (server.address() as AddressInfo).port;
    return (body: unknown, token = TOKEN) =>
      fetch(`http://127.0.0.1:${port}/vapi/webhook`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
  }

  it("rejects requests without the bearer token", async () => {
    const post = await start(new CallStore());
    expect((await post({ message: { type: "status-update" } }, "wrong-token-000000000")).status).toBe(401);
  });

  it("refuses to start with a weak token", () => {
    expect(() => createWebhookServer({ store: new CallStore(), bearerToken: "short" })).toThrow();
  });

  it("stores record_outcome tool calls and answers Vapi", async () => {
    const store = new CallStore();
    const post = await start(store);
    const res = await post({
      message: { type: "tool-calls", call: { id: "call-9" }, toolCallList: [{ id: "tc1", name: "record_outcome", parameters: { outcome: "confirmed" } }, { id: "tc2", name: "record_outcome", parameters: { outcome: "bogus" } }] },
    });
    const body = (await res.json()) as { results: { toolCallId: string; result: string }[] };
    expect(body.results[0]).toEqual({ toolCallId: "tc1", result: "Recorded. Now say goodbye and end the call." });
    expect(body.results[1]!.result).toMatch(/Invalid/);
    expect(store.find("call-9")?.agentReport).toEqual({ outcome: "confirmed" });
  });

  it("stores end-of-call reports once, even if delivered twice", async () => {
    const store = new CallStore();
    const post = await start(store);
    const waiting = store.waitForResult("call-123", 2000);
    expect((await post({ message: fixtureReport() })).status).toBe(200);
    expect((await post({ message: fixtureReport() })).status).toBe(200);
    const r = await waiting;
    expect(r.endReason).toBe("completed");
    expect(r.detectedLanguage).toBe("ur");
    expect(store.all()).toHaveLength(1);
  });

  it("returns 400 for malformed JSON", async () => {
    const store = new CallStore();
    await start(store);
    const port = (server!.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/vapi/webhook`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: "{not json" });
    expect(res.status).toBe(400);
  });
});

function fixtureReport() {
  return {
    type: "end-of-call-report" as const,
    endedReason: "assistant-ended-call",
    call: { id: "call-123" },
    startedAt: "2026-09-24T10:00:00.000Z",
    endedAt: "2026-09-24T10:01:14.000Z",
    artifact: {
      recordingUrl: "https://storage.test/rec.wav",
      messages: [
        { role: "system", message: "prompt" },
        { role: "bot", message: "السلام علیکم، میں سارہ بات کر رہی ہوں۔", secondsFromStart: 0.5 },
        { role: "user", message: "جی، بول رہی ہوں۔", secondsFromStart: 6 },
        { role: "bot", message: "کیا آپ داخلہ لیں گی؟", secondsFromStart: 9 },
        { role: "user", message: "نہیں، مجھے کہیں اور داخلہ مل گیا ہے۔", secondsFromStart: 14 },
        { role: "tool_calls", toolCalls: [{ function: { name: "record_outcome", arguments: '{"outcome":"declined","reason":"Admitted elsewhere"}' } }] },
      ],
    },
  };
}
