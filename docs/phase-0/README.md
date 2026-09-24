# Phase 0 — Research & Planning: Status

> **Closed on 24 Sep 2026 — done with assumptions.** The project owner accepted the working assumptions below so Phase 2/3 can proceed. Each assumption is replaced by the real input when it arrives (the tools are ready); the budget, provider choices and docs are updated at that point.

| # | Checklist item | Deliverable | Status |
|---|---|---|---|
| 1 | Requirements & project documentation | [0.1-requirements.md](0.1-requirements.md) + docs 01–07 | ✅ Done. Defaults adopted for Q1–Q13 (24 Sep 2026). Q1, Q11 and Q13 still open |
| 2 | Cost estimate & cost model | [01-cost-estimate.md](../01-cost-estimate.md), `npm run cost` | ✅ Done |
| 3 | Legal & compliance research | [06-legal-compliance.md](../06-legal-compliance.md) | ✅ Done |
| 4 | GitHub repo + README | <https://github.com/Syedo-maker/callbot> | ✅ Done |
| 5 | Data audit of a real applicant export | [0.2-data-audit.md](0.2-data-audit.md), `npm run audit`, [sample report](data-audit-sample-report.md) | ✅ Done with assumptions (A1). Real export still to be audited |
| 6 | Provider bake-off (7 languages) | [0.3-provider-bakeoff.md](0.3-provider-bakeoff.md), `npm run bakeoff`, test phrases in 7 languages | ✅ Done with assumptions (A2–A3). Bake-off still to be run |
| 7 | Carrier quotes + final budget | [0.4-carrier-rfq.md](0.4-carrier-rfq.md), `carriers/quotes.csv`, `npm run quotes`, [0.6-budget.md](0.6-budget.md) | ✅ Done with assumptions (A4–A5). Real quotes still to come |
| 8 | Legal checklist sign-off | [0.5-legal-signoff.md](0.5-legal-signoff.md) | ✅ Done with assumptions (A6). **Real signature required before any student is called** |

## Assumptions register

| # | Assumption | Replaced by | Checked before |
|---|---|---|---|
| A1 | Admissions export has the README columns (name, phone, gender, program, optional language/ID). About 5–10% of rows need fixing (bad phones, duplicates, missing gender) | `npm run audit` on the real/anonymised export | First real upload (Phase 3) |
| A2 | Provider stack: Vapi platform, Deepgram `flux-general-multi` STT, ElevenLabs Flash TTS, Claude Haiku 4.5 in-call LLM. Urdu/English/Punjabi/Sindhi/Arabic/Hindi at launch, Pashto in pilot | `npm run bakeoff` results + decision record in [0.3](0.3-provider-bakeoff.md) | Phase 1 live test calls |
| A3 | Draft translations (test phrases, opening lines, notices) are acceptable for development | Native-speaker review | Phase 5 conversation tests |
| A4 | Local trunk about PKR 3.3/min, 60/60 billing, 10 channels, university UAN as caller ID, AI calling permitted. International via Twilio | Real quotes in `carriers/quotes.csv` → `npm run quotes` | Phase 1 telephony (item 9) |
| A5 | Budget: PKR 4.06M year 1 (incl. 15% contingency), PKR 726k per campaign | Budget recomputed from real quotes and chosen providers | Before spending beyond trial credits |
| A6 | Legal decisions L1–L11 approved as recommended: recording notice on every call, `on_ask` disclosure in Pakistan, `upfront` for EU/UK/US, recordings 90 days / transcripts 1 year, opt-outs honoured immediately | Signed [0.5 legal pack](0.5-legal-signoff.md) | **Hard gate: Phase 5 pilot, before any real student is called** |

## Still to collect (replaces the assumptions above)

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

- [x] Providers chosen: provisionally (A2)
- [x] Carrier: assumed (A4). Contract still to be signed
- [x] Legal checklist: assumed (A6). Signature is a hard gate before the pilot
- [x] Budget: draft accepted as the working budget (A5)

The project owner accepted these assumptions on 24 Sep 2026.

## Tools added in Phase 0

| Command | What it does |
|---|---|
| `npm run cost` | Regenerates the cost tables |
| `npm run audit -- <file>` | Data-quality report for an applicant export (phones masked) |
| `npm run bakeoff -- check\|tts\|stt\|roundtrip` | STT/TTS comparison across providers and languages |
| `npm run quotes` | Per-campaign telephony cost for each carrier quote |
| `npm test` | 21 unit tests (ingest, audit, metrics, phrase coverage, cost model) |
