// Phase 1, items 10–12 — create or update the two Vapi assistants (Sara ♀ / Ali ♂) from config + prompt.
//
//   npm run vapi:sync -- --dry-run     write payloads to out/vapi/ and print a summary (no API calls)
//   npm run vapi:sync                  create (first run) or update (IDs in .env) both assistants
//
// Needs: VAPI_API_KEY, VAPI_WEBHOOK_URL, optional VAPI_SERVER_CREDENTIAL_ID, VAPI_ASSISTANT_ID_FEMALE/MALE for updates.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { loadCampaignConfig, loadPersonas, loadVoiceStack } from "../src/config.ts";
import { loadAgentTemplate } from "../src/prompts/buildSystemPrompt.ts";
import { VapiClient } from "../src/telephony/vapi/client.ts";
import { buildAssistantPayload } from "../src/telephony/vapi/payloads.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false }, config: { type: "string" } } });

const config = loadCampaignConfig(values.config);
const personas = loadPersonas();
const stack = loadVoiceStack();
const template = loadAgentTemplate();
const serverUrl = process.env.VAPI_WEBHOOK_URL || "https://YOUR-PUBLIC-HOST/vapi/webhook";
const serverCredentialId = process.env.VAPI_SERVER_CREDENTIAL_ID || undefined;

const warnings: string[] = [];
if (!process.env.VAPI_WEBHOOK_URL) warnings.push("VAPI_WEBHOOK_URL not set — using a placeholder URL");
for (const g of ["female", "male"] as const) if (stack.voices[g].voiceId.startsWith("TBD")) warnings.push(`voices.${g}.voiceId is a placeholder (pick in the bake-off)`);

await mkdir("out/vapi", { recursive: true });
for (const gender of ["female", "male"] as const) {
  const payload = buildAssistantPayload({ gender, config, personas, stack, template, serverUrl, ...(serverCredentialId ? { serverCredentialId } : {}) });
  const file = `out/vapi/assistant-${gender}.json`;
  await writeFile(file, JSON.stringify(payload, null, 2) + "\n");
  console.log(`${payload.name}: prompt v${payload.metadata.promptVersion}, ${payload.model.provider}/${payload.model.model}, voice ${payload.voice.provider}/${payload.voice.voiceId} → ${file}`);

  if (values["dry-run"]) continue;
  const client = VapiClient.fromEnv();
  const envKey = gender === "female" ? "VAPI_ASSISTANT_ID_FEMALE" : "VAPI_ASSISTANT_ID_MALE";
  const existing = process.env[envKey];
  if (existing) {
    await client.request("PATCH", `/assistant/${existing}`, payload);
    console.log(`  ✓ updated ${existing}`);
  } else {
    const created = await client.request<{ id: string }>("POST", "/assistant", payload);
    console.log(`  ✓ created — add to .env:  ${envKey}=${created.id}`);
  }
}
for (const w of warnings) console.warn(`⚠ ${w}`);
if (values["dry-run"]) console.log("\nDry run: no API calls made.");
