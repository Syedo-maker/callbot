# 04 — Prompt Design

Two model roles, two prompts:

| Role | Prompt | Runs | Model |
|---|---|---|---|
| **In-call agent** (Sara / Ali) | [`prompts/agent-system-prompt.md`](../prompts/agent-system-prompt.md) | Live, every turn of the call, inside the voice platform | Fast, low-latency model chosen in the Phase 0 bake-off |
| **Post-call classifier** | [`prompts/classifier-prompt.md`](../prompts/classifier-prompt.md) | Once per connected call, after the call ends | `CLASSIFIER_MODEL` (default `claude-opus-5`) with structured JSON output |

## 1. In-call agent prompt: design choices

| Choice | Reason |
|---|---|
| **Explain why** (seat planning) instead of only giving rules | The model handles unexpected situations better when it knows the goal (for example a parent answering, or a conditional "yes") |
| **One or two short sentences per reply** | Voice callers can't skim. Long replies raise cost, blow the 2-minute limit and invite interruptions |
| **"Speak the language the caller speaks"**, with Urdu–English mixing allowed | Real Pakistani speech is code-mixed. A rigid single language sounds robotic |
| **Gendered grammar tied to the persona** | Urdu/Hindi/Punjabi/Sindhi verbs change with the speaker's gender. Ali must say "raha hoon", Sara "rahi hoon" |
| **Facts only from `campaign_facts`** | Stops the bot inventing fees or dates. A wrong fact from the university's own caller is the most damaging failure |
| **Redirect limit as a variable** (`max_redirects`, default 2) | Matches the brief (2–3). Tunable per campaign |
| **`record_outcome` tool, called exactly once** | The model interprets meaning. Code owns state. The outcome arrives as structured data, not parsed from text |
| **Honesty section** | Never claims to be human, never denies being AI, answers sincerely when asked. The disclosure mode (`on_ask` / `upfront`) is injected per region |
| **Safety section** | Blocks the bot from being used (or imitated) to collect OTPs, CNICs or payments, a common scam pattern in Pakistan |
| **No markdown or symbols** | Everything is sent to TTS |

**Variables** are filled by [`src/prompts/buildSystemPrompt.ts`](../src/prompts/buildSystemPrompt.ts). It throws an error if any `{{placeholder}}` is left unfilled, so a broken prompt can never reach a real call.

**Prompt caching:** everything above `# Campaign facts` is identical for every call in a campaign. Per-student values appear only in short spots. On platforms that support caching, the fixed prefix cuts LLM cost about 40–60% (see [01-cost-estimate.md](01-cost-estimate.md)).

### Example of filled variables

```text
persona_name            = Sara
persona_gender          = female
university_name         = Example University
student_name            = Ayesha Khan
program                 = BS Computer Science
opening_language_name   = Urdu
opening_line            = السلام علیکم، میں سارہ بات کر رہی ہوں، Example University کے ایڈمیشن آفس سے۔ ...
max_redirects           = 2
soft_limit_seconds      = 90
disclosure_instruction  = (on_ask) Do not bring up that you are automated unless asked. ...
campaign_facts          = - Fee deadline: 15 October 2026
                          - Orientation: 20 October 2026, 10 am, main auditorium
                          - Next step after confirming: pay the fee voucher sent by SMS
```

## 2. Post-call classifier: design choices

- It **reviews** the agent's own `record_outcome`; it doesn't blindly trust it. If they disagree, or confidence is below 0.7, the call goes to `escalation.csv` as `classifier_disagreement` / `low_confidence`. A human then decides, so no student is silently mis-filed.
- **Structured output** (JSON schema enforced by the API through `zodOutputFormat`) returns `outcome`, `reason`, `summary`, `language_used`, `needs_human` and `confidence`. No regex parsing.
- The prompt states the **cost of each error** (a false "confirmed" holds a seat, a false "declined" can cost a student their seat). The model then leans towards `needs_human` when unsure.
- It tolerates **speech-recognition errors** and **code-mixing**.
- Summary and reason are always in **English**, so the staff spreadsheet is uniform whatever language the call was in.
- If the API refuses or errors, the call is marked `escalation / low_confidence` and **never dropped**.

## 3. Testing prompts

Prompt edits change behaviour without any visible error, so each change must pass:
1. **Scripted conversation tests** (Phase 5), about 20 scenarios × 7 languages: confirm, decline with reason, undecided, parent answers, wrong number, off-topic ×3, "are you a bot?", "stop calling", asks the fee, silence, Urdu–English mixing.
2. **Classifier eval set**: 200 labelled pilot transcripts. Target ≥ 97% agreement on confirmed/declined and 0 silent mis-files (disagreements must land in escalation).
3. **Native-speaker review** of opening lines and sample calls in every launch language.
