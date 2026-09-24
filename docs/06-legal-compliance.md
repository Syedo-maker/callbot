# 06 — Legal & Compliance Notes

> **This is engineering guidance, not legal advice.** Laws below were checked in September 2026 from public sources. The university's legal office must confirm them before the pilot (Phase 0 deliverable: signed legal checklist).

## 1. Pakistan (≈90% of calls)

| Topic | What applies | What we do |
|---|---|---|
| **Call recording** | Pakistan requires **all-party consent** to record calls (PECA 2016, as amended in 2025, and a March 2026 Supreme Court ruling as reported by recordinglaw.com). Consent can be given verbally or through a notice at the start of the call | A **recording notice in the opening line** of every call ("This call is recorded for quality purposes"). Add a consent clause to the admission application/offer letter too. If a student objects, stop recording for that call (Vapi supports turning recording off per call) or end the call and escalate |
| **Unsolicited / spam calls** | PTA *Protection from Spam, Unsolicited, Fraudulent and Obnoxious Communication Regulations, 2009*: operators run Do-Not-Call registers and blacklist spam originators | These are **transactional calls to people who applied**, not telemarketing. Still: call from a **registered university number**, honour opt-outs immediately (`opted_out` → never retried), keep volumes and hours reasonable, and give the operator advance notice of the campaign so the trunk isn't flagged as spam |
| **Who can carry voice traffic** | Voice traffic must be originated and terminated through **licensed operators** (LL/LDI). Registered call centres need PSEB registration. Bringing internet voice into Pakistan through unlicensed routes ("grey traffic") is illegal | Terminate PK calls **only through a licensed operator trunk** contracted by the university (Option B). International legs go through Twilio/Telnyx. Ask the operator in writing whether AI-assisted outbound calling on the trunk is permitted and whether PSEB registration applies to the university's own outbound calling |
| **Data protection** | Pakistan has **no enacted personal data protection act** as of May 2026. The Personal Data Protection Bill (2023 / 2025 draft) is still pending. PECA 2016 (amended 2025) covers unauthorised access and misuse | Follow the Bill's principles anyway (consent, purpose limitation, retention limits, security; see [05-data-privacy-security.md](05-data-privacy-security.md)). This will likely become mandatory soon |
| **AI disclosure** | No specific Pakistani law requires AI disclosure on calls as of Sept 2026 | `on_ask` mode by default: never claims to be human, and answers honestly when asked. See §4 |
| **Calling hours** | No fixed statutory window found | Configured windows: **10:00–13:00 and 15:00–19:30 PKT, Mon–Sat**. No calls during Friday Jumu'ah (13:00–14:30 is already outside the window). Pause on public holidays and on Muharram 9–10 |

## 2. Other regions (≈10% of calls)

| Region | Key rules | Our setting |
|---|---|---|
| **EU / EEA** | **EU AI Act Art. 50 (in force 2 Aug 2026):** an AI phone agent must tell the person they are talking to a machine, and on whose behalf, at the latest at the first interaction. Fines up to €15M / 3%. GDPR applies to EU residents' data | `disclosure: upfront` for EU/EEA country codes. Lawful basis: legitimate interest / pre-contractual step. Recording notice |
| **UK** | UK GDPR. PECR restricts automated calls with recorded messages without consent. A live AI conversation is a grey area | `disclosure: upfront`. Treat as consent-required: only call UK numbers if the application form has consent |
| **UAE / KSA / Qatar** | UAE PDPL and Saudi PDPL (consent, purpose, cross-border transfer rules). Telecom regulators restrict unsolicited calls and calling hours | Local calling window by recipient time zone. Recording notice. Rely on application-form consent |
| **USA** | TCPA: AI-generated voices count as "artificial" voice (FCC 2024), so **prior express consent** is required for calls to mobiles | Only call US numbers with explicit consent. `disclosure: upfront`. Or route US applicants to human callers |

Country behaviour is driven by the phone number's country code (`disclosureByCountry`, `callingWindows` by recipient time zone in `config/campaign.example.json`).

## 3. Consent language for the application form (proposed)

> "By submitting this application, I agree that {University} may contact me by phone, including through an automated assistant, about my admission. Calls may be recorded for quality and record-keeping. I can ask not to be called at any time."

Adding this before the next admission cycle removes most of the legal uncertainty above.

## 4. The AI-disclosure requirement

The brief asks that the bot **not volunteer** that it is AI, but **answer honestly** if sincerely asked. Our position:

- **Pakistan:** allowed as designed (`on_ask`). The agent never claims to be human and never denies being AI.
- **EU/EEA:** not allowed. Upfront disclosure is legally required, so `upfront` is forced for those numbers.
- **Everywhere:** upfront disclosure is recommended. It costs about 2 seconds, strengthens trust, and guards against a viral "university tricks students with fake callers" story. The personas (Sara/Ali) can stay either way.

## 5. Pre-pilot legal checklist (Phase 0 deliverable)

- [ ] Legal office confirms recording-notice wording (all languages)
- [ ] Consent clause added to application form / offer letter
- [ ] Carrier confirms in writing: AI outbound calling permitted on the trunk, caller ID = university UAN
- [ ] PSEB / PTA registration requirement checked for the university's outbound calling
- [ ] DPAs signed with voice platform, STT, TTS, LLM and telephony vendors
- [ ] Retention periods approved (recordings 90 days, transcripts 1 year)
- [ ] Disclosure mode approved per region
- [ ] Opt-out handling and complaint route approved (who calls back escalations)

## Sources

- Pakistan recording law: <https://www.recordinglaw.com/world-laws/world-recording-laws/pakistan-recording-laws/>
- Pakistan data protection status: <https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/pakistan>, <https://www.recordinglaw.com/world-laws/world-data-privacy-laws/pakistan-data-privacy-laws/>
- PTA spam regulations 2009: <https://propakistani.pk/2009/08/19/protection-from-spam-unsolicited-fraudulent-and-obnoxious-communication-regulations-2009/>, <https://www.pta.gov.pk/en/media-center/single-media/pta-issues-regulations-for-unsolicited-and-obnoxious-communications>
- Voice traffic licensing / call centres: <https://groups.google.com/g/telecom-grid-pakistan/c/bwjZZJz2JGQ>
- EU AI Act Art. 50: <https://artificialintelligenceact.eu/article/50/>, <https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026>
- Vapi TCPA guidance: <https://docs.vapi.ai/tcpa-consent>
