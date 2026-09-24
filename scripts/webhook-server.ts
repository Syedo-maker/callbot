// Standalone Vapi webhook receiver.  npm run webhook   (PORT default 3000, results → data/calls.jsonl)
import { existsSync } from "node:fs";
import { CallStore } from "../src/store/callStore.ts";
import { createWebhookServer } from "../src/telephony/vapi/webhookServer.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const port = Number(process.env.PORT ?? 3000);
const store = new CallStore(process.env.CALL_STORE_FILE ?? "data/calls.jsonl");
const server = createWebhookServer({
  store,
  bearerToken: process.env.VAPI_WEBHOOK_BEARER_TOKEN ?? "",
  log: (m) => console.log(`${new Date().toISOString()} ${m}`),
});
server.listen(port, () => console.log(`CallBot webhook listening on :${port}/vapi/webhook (${store.all().length} calls loaded)`));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => server.close(() => process.exit(0)));
