// Phase 1, item 13 — place ONE test call to a staff phone and print the outcome + transcript.
//
//   npm run call:test -- --to 03001234567 --name "Test Student" --gender f --program "BS CS" [--lang ur] [--dry-run] [--provider mock]
//
// Live mode starts the webhook server in this process (PORT, default 3000). VAPI_WEBHOOK_URL must be a public
// HTTPS URL that forwards to it (e.g. `ngrok http 3000`). Only call numbers whose owners agreed to test calls.
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadCampaignConfig, loadPersonas, loadVoiceStack, resolveEnv } from "../src/config.ts";
import { normalizePhone } from "../src/ingest/parseDataset.ts";
import { normalizeLanguage } from "../src/language/languages.ts";
import { CallStore } from "../src/store/callStore.ts";
import { MockVoiceProvider } from "../src/telephony/mockProvider.ts";
import { prepareCallRequest } from "../src/telephony/prepareCall.ts";
import { VapiClient } from "../src/telephony/vapi/client.ts";
import { buildCallPayload, phoneNumberIdFor } from "../src/telephony/vapi/payloads.ts";
import { VapiVoiceProvider } from "../src/telephony/vapi/vapiProvider.ts";
import { createWebhookServer } from "../src/telephony/vapi/webhookServer.ts";
import type { Applicant } from "../src/types.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const { values } = parseArgs({
  options: {
    to: { type: "string" },
    name: { type: "string", default: "Test Student" },
    gender: { type: "string", default: "f" },
    program: { type: "string", default: "BS Computer Science" },
    lang: { type: "string" },
    provider: { type: "string", default: "vapi" },
    "dry-run": { type: "boolean", default: false },
    "timeout-min": { type: "string", default: "5" },
  },
});

const phone = normalizePhone(values.to);
if (!phone.e164) {
  console.error("Give a valid number with --to (e.g. 03001234567 or +923001234567)");
  process.exit(1);
}
const lang = normalizeLanguage(values.lang);
const applicant: Applicant = {
  id: "test-call",
  name: values.name!,
  gender: values.gender!.toLowerCase().startsWith("m") ? "male" : "female",
  phone: phone.e164,
  country: phone.country ?? "PK",
  program: values.program!,
  ...(lang ? { preferredLanguage: lang } : {}),
  extra: {},
};

const config = loadCampaignConfig();
const req = prepareCallRequest(applicant, `test:${Date.now()}:1`, config, loadPersonas());
console.log(`Persona ${req.persona.name} · opening language ${req.openingLanguage} · disclosure ${req.disclosure}`);
console.log(`Opening line: ${req.openingLine}\n`);

const store = new CallStore("data/test-calls.jsonl");
const stack = loadVoiceStack();
const routing = { pakistan: resolveEnv(stack.phoneNumbers.pakistan), international: resolveEnv(stack.phoneNumbers.international) };

if (values["dry-run"]) {
  const payload = buildCallPayload(req, "<assistant-id>", routing.pakistan || routing.international ? phoneNumberIdFor(applicant.country, routing) : "<phone-number-id>");
  console.log(JSON.stringify({ ...payload, customer: { ...payload.customer, number: payload.customer.number.replace(/\d(?=\d{3})/g, "*") } }, null, 2));
  console.log("\nDry run: no call placed.");
  process.exit(0);
}

let server: ReturnType<typeof createWebhookServer> | undefined;
let provider;
if (values.provider === "mock") {
  provider = new MockVoiceProvider(store);
} else {
  const port = Number(process.env.PORT ?? 3000);
  server = createWebhookServer({ store, bearerToken: process.env.VAPI_WEBHOOK_BEARER_TOKEN ?? "", log: (m) => console.log(`[webhook] ${m}`) });
  await new Promise<void>((r) => server!.listen(port, r));
  console.log(`Webhook server listening on :${port} — make sure ${process.env.VAPI_WEBHOOK_URL ?? "VAPI_WEBHOOK_URL"} forwards here.`);
  provider = new VapiVoiceProvider({
    client: VapiClient.fromEnv(),
    store,
    assistants: { female: process.env.VAPI_ASSISTANT_ID_FEMALE ?? "", male: process.env.VAPI_ASSISTANT_ID_MALE ?? "" },
    phoneNumbers: routing,
  });
}

const placed = await provider.placeCall(req);
console.log(`Call placed: ${placed.providerCallId}. Waiting for the end-of-call report…`);
try {
  const r = await store.waitForResult(placed.providerCallId, Number(values["timeout-min"]) * 60_000);
  const report = store.find(placed.providerCallId)?.agentReport ?? r.agentReport;
  console.log(`\nEnded: ${r.endReason} · ${r.durationSec}s · agent outcome: ${report ? `${report.outcome}${report.reason ? ` (${report.reason})` : ""}` : "none"}`);
  if (r.recordingUrl) console.log(`Recording: ${r.recordingUrl}`);
  for (const t of r.transcript) console.log(`  ${t.role === "agent" ? req.persona.name.padEnd(8) : "Student "}| ${t.text}`);
} finally {
  server?.close();
}
