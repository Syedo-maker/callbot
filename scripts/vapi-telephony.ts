// Phase 1, item 9 — register phone routes in Vapi.
//
//   npm run vapi:telephony -- byo-trunk   [--apply]   SIP trunk credential pointing at our SBC + the university UAN as a BYO number
//   npm run vapi:telephony -- twilio      [--apply]   import the Twilio number used for international calls
//
// Without --apply it prints the request with secrets redacted. Field names follow the Vapi phone-number /
// credential APIs as of Sept 2026 — re-check https://docs.vapi.ai/advanced/sip/sip-trunk before applying.
// Secrets are read from .env and never written to disk or printed.
import { existsSync } from "node:fs";
import { VapiClient } from "../src/telephony/vapi/client.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const [cmd] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");

const need = (k: string) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
  return v;
};
const redact = (o: unknown) => JSON.stringify(o, (k, v) => (/password|token|secret|authToken/i.test(k) ? "***" : v), 2);

if (cmd === "byo-trunk") {
  const credential = {
    provider: "byo-sip-trunk",
    name: "CallBot PK SBC",
    gateways: [{ ip: need("SBC_PUBLIC_IP"), inboundEnabled: false }],
    outboundLeadingPlusEnabled: true,
    outboundAuthenticationPlan: { authUsername: need("SBC_SIP_USERNAME"), authPassword: need("SBC_SIP_PASSWORD") },
  };
  const number = (credentialId: string) => ({
    provider: "byo-phone-number",
    name: "University UAN (PK)",
    number: need("UNIVERSITY_CALLER_ID"),
    numberE164CheckEnabled: true,
    credentialId,
  });
  console.log("POST /credential\n" + redact(credential));
  console.log("POST /phone-number\n" + redact(number("<credential-id>")));
  if (apply) {
    const client = VapiClient.fromEnv();
    const cred = await client.request<{ id: string }>("POST", "/credential", credential);
    const pn = await client.request<{ id: string }>("POST", "/phone-number", number(cred.id));
    console.log(`\n✓ Created. Add to .env:\nVAPI_SIP_CREDENTIAL_ID=${cred.id}\nVAPI_PHONE_NUMBER_ID_PK=${pn.id}`);
  }
} else if (cmd === "twilio") {
  const body = {
    provider: "twilio",
    name: "International (Twilio)",
    number: need("TWILIO_NUMBER"),
    twilioAccountSid: need("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: need("TWILIO_AUTH_TOKEN"),
  };
  console.log("POST /phone-number\n" + redact(body));
  if (apply) {
    const pn = await VapiClient.fromEnv().request<{ id: string }>("POST", "/phone-number", body);
    console.log(`\n✓ Imported. Add to .env:\nVAPI_PHONE_NUMBER_ID_INTL=${pn.id}`);
  }
} else {
  console.error("Usage: npm run vapi:telephony -- byo-trunk|twilio [--apply]");
  process.exit(1);
}
if (!apply) console.log("\nPreview only. Re-run with --apply to create these in Vapi.");
