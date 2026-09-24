# 05 — Data Privacy & Security

CallBot processes personal data of thousands of young people: names, phone numbers, gender, program, **voice recordings** and transcripts. Treat all of it as confidential.

## 1. Data inventory

| Data | Source | Where stored | Retention (proposed) |
|---|---|---|---|
| Applicant list (name, gender, phone, program, language) | Admissions upload | Postgres (encrypted at rest) | Campaign + 90 days, then delete or anonymise |
| Call attempts (time, duration, end reason, outcome, summary) | CallBot | Postgres | 1 year (needed for audit and next-year planning), then aggregate only |
| Result CSVs | CallBot | Generated on demand. Downloads logged | Staff handle per university records policy |
| Recordings (audio) | Voice platform → our storage | Encrypted object storage, private bucket | **90 days**, then auto-delete (lifecycle rule) |
| Transcripts | Voice platform → our storage | Encrypted object storage | 1 year |
| Vendor copies (Vapi, STT/TTS, LLM) | Automatic | Vendor | Configure the **shortest retention** each vendor allows. Turn off vendor-side recording storage once our copy is saved |

## 2. Principles

1. **Data minimisation.** Send the voice platform and LLM only what the call needs: first name, program and language. No CNIC, marks, address or fee status.
2. **Purpose limitation.** Data is used only for admission confirmation. Don't reuse it for marketing.
3. **Least privilege.** Staff roles are `viewer` (downloads), `operator` (start/pause) and `admin` (upload, config). Every download and recording playback is logged.
4. **Encryption.** TLS everywhere, SRTP/TLS on SIP legs where the carrier supports it, encryption at rest for the database and object storage.
5. **Secrets.** API keys live only in environment variables or a secret manager. `.env` is git-ignored and never committed. Keys are rotated after each campaign.
6. **Real data never goes in git.** The `.gitignore` excludes `data/`, `recordings/`, `transcripts/`, `out/` and `*.xlsx`. Tests use the synthetic `samples/applicants.sample.csv` only.
7. **Vendor due diligence.** Before production, collect each vendor's DPA, data-location statement and retention controls (Vapi, STT, TTS, LLM, telephony). Prefer vendors that don't train on customer data by default.

## 3. Application security

| Area | Control |
|---|---|
| Dashboard auth | University SSO (Google Workspace / Microsoft Entra) or email + TOTP. No shared accounts |
| Webhooks | Vapi bearer or HMAC credential checked on every request. Reject anything unsigned. Idempotent upsert by call ID |
| Upload | Size limit, CSV/XLSX only, parsed server-side, formulas never executed. Output CSVs escape leading `= + - @` (CSV injection) |
| Prompt injection | A caller can say anything. The agent only has two tools (`record_outcome`, `end_call`) and no access to other records. The classifier's output is schema-constrained. Transcripts are data, not instructions |
| Abuse | Rate limits, a kill switch, and dialling only numbers from an uploaded, approved campaign. No free-form "call this number" endpoint |
| Dependencies | `npm audit` in CI. Pinned lockfile |
| Logging | No full phone numbers or transcripts in application logs. Use applicant IDs and masked numbers (`+92300****567`) |

## 4. Incident response (short form)

1. Kill switch → stop dialling.
2. Rotate affected keys.
3. Identify affected records from the audit log.
4. Inform the university's data owner and legal office within 24 hours.
5. Notify affected applicants if their data was exposed.
