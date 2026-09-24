# Phase 1 — Core Setup: Status & Runbook

**Goal:** the bot can call a staff phone from the university number, speak as Sara or Ali in Urdu/English, and deliver the transcript, recording and outcome back to our system.

## Status

| # | Checklist item | What's built | Status |
|---|---|---|---|
| 9 | Telephony | Asterisk SBC (`telephony/sbc/`: PJSIP + dialplan templates, +92-only fraud guard, UAN caller ID, channel cap, Docker Compose). `npm run vapi:telephony` registers the BYO SIP trunk + UAN and imports the Twilio number. Country-based routing (PK → trunk, others → Twilio) | 🟡 Ready. Needs the carrier trunk (Phase 0 item 7), a VM with a static IP, and a Twilio account |
| 10 | Speech-to-text | Configured in `config/voice-stack.json`: Deepgram `flux-general-multi` with auto language detection (provisional). ElevenLabs Scribe is the alternative | 🟡 Wired. Final choice after the bake-off (item 6) |
| 11 | Text-to-speech | Sara/Ali voices per gender in `config/voice-stack.json`. Localised persona names (`config/personas.json`). Opening lines in 7 languages with gender-correct verbs | 🟡 Wired. Voice IDs are placeholders until the bake-off |
| 12 | LLM conversation engine | Two assistants built from code (`buildAssistantPayload`): system prompt with campaign variables filled and per-call variables left for Vapi, `record_outcome` function tool + native `endCall`, 120 s max, silence timeout, recording, webhook. `npm run vapi:sync` creates/updates them | 🟡 Ready to sync. Needs `VAPI_API_KEY` |
| 13 | Provider adapter + webhook | `VoiceProvider` interface, `MockVoiceProvider`, `VapiVoiceProvider`, webhook server (bearer auth with timing-safe compare, `tool-calls` → agent outcome, `end-of-call-report` → result, idempotent, 5 MB limit), durable `CallStore` (JSONL), `npm run call:test` | ✅ Built and tested (26 new tests). Live check pending |

## Exit criteria (from the project plan)

- [ ] 20 test calls to staff phones in Urdu + English
- [ ] 100% webhook capture (every call has a stored result)
- [ ] Median response latency under 1.2 s
- [ ] University UAN shown as caller ID on Jazz, Zong, Telenor and Ufone

These need real accounts, so they're done during the runbook below.

## Runbook (once keys and the trunk exist)

```bash
cp .env.example .env                               # fill VAPI_*, TWILIO_*, SBC_*, CARRIER_*
# 1. Webhook reachable from the internet
npm run webhook                                    # terminal 1 (port 3000)
ngrok http 3000                                    # terminal 2 → put https://…/vapi/webhook in VAPI_WEBHOOK_URL
#    In the Vapi dashboard create a Bearer-token credential with VAPI_WEBHOOK_BEARER_TOKEN → VAPI_SERVER_CREDENTIAL_ID

# 2. Assistants
npm run vapi:sync -- --dry-run                     # review out/vapi/assistant-*.json
npm run vapi:sync                                  # first run prints VAPI_ASSISTANT_ID_FEMALE / _MALE for .env

# 3. Telephony
cd telephony/sbc && docker compose up -d && cd ../..   # on the SBC VM
npm run vapi:telephony -- byo-trunk --apply        # → VAPI_PHONE_NUMBER_ID_PK
npm run vapi:telephony -- twilio --apply           # → VAPI_PHONE_NUMBER_ID_INTL

# 4. Test calls (only to people who agreed)
npm run call:test -- --to 03xxxxxxxxx --name "Test" --gender f --lang ur
npm run call:test -- --to 03xxxxxxxxx --name "Test" --gender m --lang en
```

Without any keys you can still run everything offline:

```bash
npm run vapi:sync -- --dry-run
npm run call:test -- --to 03001234567 --dry-run
npm run call:test -- --to 03451234567 --gender m --lang pa --provider mock
```

## Design notes

- **Per-call variables.** The saved assistants contain the prompt with `{{student_name}}`, `{{program}}`, `{{opening_line}}`, `{{opening_language_name}}` and `{{disclosure_instruction}}` left as placeholders. Each call fills them through `assistantOverrides.variableValues`, and `firstMessage` is overridden with the pre-approved opening line. Campaign-level values (university, facts, redirect limit) are baked in at sync time, so a sync is needed when they change. `metadata.promptVersion` shows which prompt a call used.
- **Two sources for the outcome.** The agent's `record_outcome` arrives live through `tool-calls` and is also re-read from the end-of-call report's messages. The first valid one wins. Phase 3 adds the Claude classifier as a second opinion.
- **Idempotency.** Results are keyed by the Vapi call ID. A duplicate webhook is ignored. A timeout on `POST /call` doesn't prove failure, so the Phase 3 orchestrator must look up the attempt before retrying.
- **Secrets.** Nothing secret is committed or printed. `vapi:telephony` redacts passwords/tokens in previews. The webhook refuses to start with a token shorter than 16 characters.
- **To verify on first live run:** Vapi rejects unknown fields with a 400, so check the model id `anthropic/claude-haiku-4-5`, `artifactPlan.recordingEnabled`, and the BYO trunk credential fields (`gateways`, `outboundAuthenticationPlan`) against the current API reference.
