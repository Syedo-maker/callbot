# Phase 0 — Research & Planning: Status

| # | Checklist item | Deliverable | Status |
|---|---|---|---|
| 1 | Requirements & project documentation | [0.1-requirements.md](0.1-requirements.md) + docs 01–07 | ✅ Done. Defaults adopted for Q1–Q13 (24 Sep 2026). Q1, Q11 and Q13 still open |
| 2 | Cost estimate & cost model | [01-cost-estimate.md](../01-cost-estimate.md), `npm run cost` | ✅ Done |
| 3 | Legal & compliance research | [06-legal-compliance.md](../06-legal-compliance.md) | ✅ Done |
| 4 | GitHub repo + README | <https://github.com/Syedo-maker/callbot> | ✅ Done |
| 5 | Data audit of a real applicant export | [0.2-data-audit.md](0.2-data-audit.md), `npm run audit`, [sample report](data-audit-sample-report.md) | 🟡 Tool built and tested. **Needs the real export** |
| 6 | Provider bake-off (7 languages) | [0.3-provider-bakeoff.md](0.3-provider-bakeoff.md), `npm run bakeoff`, test phrases in 7 languages | 🟡 Kit built and tested. **Needs API trial keys + native-speaker recordings** |
| 7 | Carrier quotes + final budget | [0.4-carrier-rfq.md](0.4-carrier-rfq.md), `carriers/quotes.csv`, `npm run quotes`, [0.6-budget.md](0.6-budget.md) | 🟡 RFQ letter and comparison tool ready, budget drafted. **Needs RFQs sent + quotes back** |
| 8 | Legal checklist sign-off | [0.5-legal-signoff.md](0.5-legal-signoff.md) | 🟡 Sign-off pack ready (decisions L1–L11, notices in 7 languages, consent clause). **Needs legal office decisions + signatures** |

## What the university needs to do to close Phase 0

| # | Action | Owner | Unblocks |
|---|---|---|---|
| 1 | ~~Answer Q1–Q13~~ defaults adopted. Remaining: Q1 (export sample), Q11 (caller ID), Q13 (budget) | Director Admissions | Items 5, 7 |
| 2 | Run `npm run audit` on the real admissions export (or send an anonymised ≥ 200-row sample) | Admissions + IT | Item 5 |
| 3 | Create trial accounts and put keys in `.env`: ElevenLabs, Deepgram, Azure Speech, Vapi (+ Retell). Request Uplift AI access | IT | Item 6 |
| 4 | Native speakers correct `bakeoff/test-phrases.json`, record S1–S8 over the phone, and score the TTS samples | Admissions (volunteer staff/students) | Item 6 |
| 5 | Send the RFQ letter to ≥ 3 operators. Enter the quotes in `carriers/quotes.csv` | IT / Procurement | Item 7 |
| 6 | Legal office decides L1–L11 and signs | Legal / Registrar | Item 8 |
| 7 | Finance approves the budget (after quotes) | Finance | Item 7 |

## Exit criteria (from the project plan)

- [ ] Providers chosen (bake-off decision record filled in)
- [ ] Carrier contract in progress, with AI-calling permission in writing
- [ ] Legal checklist signed
- [ ] Budget approved

**Phase 1 does not start until these are met**, or until the project owner explicitly accepts the risk of starting early.

## Tools added in Phase 0

| Command | What it does |
|---|---|
| `npm run cost` | Regenerates the cost tables |
| `npm run audit -- <file>` | Data-quality report for an applicant export (phones masked) |
| `npm run bakeoff -- check\|tts\|stt\|roundtrip` | STT/TTS comparison across providers and languages |
| `npm run quotes` | Per-campaign telephony cost for each carrier quote |
| `npm test` | 21 unit tests (ingest, audit, metrics, phrase coverage, cost model) |
