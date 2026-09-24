# CallBot

**AI voice agent that calls admitted university applicants to confirm whether they will take admission, then produces clean result datasets.**

Each admission season about 10,000 applicants need a confirmation call. Doing this by hand takes a staff team around 10 days, and many students are never reached. CallBot places the calls automatically, speaks the student's language as a gender-matched persona (**Sara** / **Ali**), records the outcome, and retries students it couldn't reach. At the end it writes:

| File | Contents |
|---|---|
| `confirmed.csv` | Students who confirmed they will take admission |
| `declined.csv` | Students who will not, with their reason |
| `no_answer.csv` | Not reached after all retry attempts |
| `escalation.csv` | Undecided, off-topic, opt-outs, asked for a human, or low-confidence calls needing a staff follow-up |
| `all_calls.csv` | Every attempt, for audit |

Every record includes timestamp, call duration, language used, number of attempts, outcome and a short summary. Transcripts are saved per call.

## Status

**Progress: 4 of 45 items done, 4 prepared and waiting on university input.** Full checklist: [docs/07-project-plan.md](docs/07-project-plan.md#progress-checklist) · Phase 0 status: [docs/phase-0/README.md](docs/phase-0/README.md).

| Phase | State |
|---|---|
| 0 — Research & Planning | 🟡 4/8 done. Tools and documents for the remaining 4 are ready; waiting on the real export, API keys + recordings, carrier quotes, legal sign-off |
| 1 — Core Setup | ⬜ |
| 2 — Conversation Logic | ⬜ (system prompt drafted in `prompts/`) |
| 3 — Data Pipeline | ⬜ (dataset parser/validator, types and campaign config started) |
| 4 — Admin Dashboard | ⬜ |
| 5 — Testing & Pilot | ⬜ |
| 6 — Rollout | ⬜ |
| 7 — Post-Campaign Review | ⬜ |

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run cost             # regenerate the cost tables in docs/01-cost-estimate.md   ✅ works now
npm test                 # unit tests                                                ✅ works now
npm run audit -- <file>  # data-quality report for an applicant export               ✅ works now
npm run bakeoff -- check # STT/TTS provider bake-off (needs API keys for tts/stt)     ✅ works now
npm run quotes           # compare carrier quotes (carriers/quotes.csv)              ✅ works now
npm run demo             # simulated campaign on samples/applicants.sample.csv → out/ ⏳ Phase 3
```

*Everything below describes the planned CLI (Phase 3).* The demo uses the **mock voice provider**, so no calls are placed and no API keys are needed. If `ANTHROPIC_API_KEY` is set, the demo also runs the Claude post-call classifier on each mock transcript. Otherwise it relies on the outcome the agent reported.

```bash
npm run callbot -- validate --input path/to/applicants.xlsx    # check a real export without calling anyone
npm run callbot -- run --input samples/applicants.sample.csv --out out --provider mock --classifier agent
```

### Input format

CSV or Excel with a header row. Column names are matched loosely (case, spaces and common aliases):

| Field | Required | Aliases | Example |
|---|---|---|---|
| `name` | ✅ | `student_name`, `applicant_name`, `full_name` | Ayesha Khan |
| `phone` | ✅ | `mobile`, `phone_number`, `contact`, `cell` | 0300-1234567 / +923001234567 |
| `gender` | ✅ | `sex` | F / Female / M / Male |
| `program` | ✅ | `programme`, `degree`, `course` | BS Computer Science |
| `preferred_language` | — | `language`, `lang` | Urdu / ur / Pashto |
| `id` | — | `applicant_id`, `application_no`, `roll_no` | 2026-0412 |

Any other columns are kept and passed through to the result files. Pakistani numbers in local format (`03xx…`) are normalised to E.164.

## Documentation

| Doc | |
|---|---|
| [01 — Cost estimate](docs/01-cost-estimate.md) | Per-minute prices, 3 architectures compared, per-campaign totals in USD and PKR, development cost |
| [02 — Architecture](docs/02-architecture.md) | Options, system diagram, tech stack, data flow, module map |
| [03 — Conversation design](docs/03-conversation-design.md) | Call flow, script, personas, language switching, AI-disclosure policy, outcome taxonomy |
| [04 — Prompt design](docs/04-prompt-design.md) | In-call agent prompt and post-call classifier prompt |
| [05 — Data privacy & security](docs/05-data-privacy-security.md) | Data inventory, retention, access control, security controls |
| [06 — Legal & compliance](docs/06-legal-compliance.md) | Pakistan (PECA, PTA), EU AI Act, UK, Gulf, US. Pre-pilot checklist |
| [07 — Project plan](docs/07-project-plan.md) | Phases 0–7, modules, deliverables, timeline, risks |

**Recommended architecture:** a managed voice-agent platform (Vapi) with a **local Pakistani SIP trunk**. It costs about **$2,280 / PKR 632k per 10,000-student campaign**, has a local caller ID, and needs no physical server. See the [cost estimate](docs/01-cost-estimate.md).

## Repository layout

```
bakeoff/           Phase 0 STT/TTS bake-off: test phrases (7 languages), candidates
carriers/          carrier quote sheet
config/            campaign + persona configuration (examples)
docs/              project documentation (docs/phase-0/: Phase 0 deliverables)
prompts/           in-call agent and post-call classifier prompts
samples/           synthetic applicant data (never commit real data)
scripts/           cost report, data audit, bake-off runner, quote comparison
src/
  ingest/          CSV/XLSX parsing, validation, phone normalisation, dedupe
  persona/         Sara / Ali selection
  language/        supported languages + opening lines
  prompts/         system prompt builder
  campaign/        retry policy, calling windows, campaign runner
  telephony/       VoiceProvider interface, mock provider, Vapi adapter
  classify/        agent-reported + Claude outcome classification
  output/          result dataset writer
  cost/            cost model
  bakeoff/         STT/TTS adapters + CER/WER metrics
test/              unit tests (vitest)
```

## Privacy

Real applicant data, recordings and transcripts **must never be committed**. `.gitignore` blocks `data/`, `out/`, `recordings/`, `transcripts/`, `.env` and `*.xlsx`. See [05 — Data privacy & security](docs/05-data-privacy-security.md).
