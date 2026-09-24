# Data Audit Report — applicants.sample.csv

Generated 2026-09-24T10:05:40.646Z by `npm run audit`.

## Summary

| Check | Count | Share |
|---|---:|---:|
| Rows in file | 20 | 100% |
| **Callable applicants** | **17** | 85.0% |
| Rejected (no name / no valid phone) | 2 | 10.0% |
| Duplicate phone numbers (dropped) | 1 | 5.0% |
| Gender missing/unrecognised → default persona | 2 | 11.8% of callable |
| Preferred language missing → auto-detect | 2 | 11.8% of callable |
| International numbers | 3 | 17.6% of callable |
| Pakistani landlines | 1 | 5.9% of callable |

## Column mapping

| Field | Column in file |
|---|---|
| id | "Application No" |
| name | "Student Name" |
| phone | "Mobile No" |
| gender | "Gender" |
| program | "Program" |
| preferredLanguage | "Preferred Language" |

## Gender

| Value | Count | Share |
|---|---:|---:|
| male | 8 | 47.1% |
| female | 7 | 41.2% |
| unknown | 2 | 11.8% |

## Preferred language

| Value | Count | Share |
|---|---:|---:|
| Urdu (ur) | 5 | 29.4% |
| English (en) | 3 | 17.6% |
| not given | 2 | 11.8% |
| Punjabi (pa) | 1 | 5.9% |
| Sindhi (sd) | 1 | 5.9% |
| Pashto (ps) | 1 | 5.9% |
| Arabic (ar) | 1 | 5.9% |
| Saraiki (skr) | 1 | 5.9% |
| Hindko (hno) | 1 | 5.9% |
| Hindi (hi) | 1 | 5.9% |

## Country of phone number

| Value | Count | Share |
|---|---:|---:|
| PK | 14 | 82.4% |
| AE | 1 | 5.9% |
| SA | 1 | 5.9% |
| GG | 1 | 5.9% |

## Pakistani mobile network

| Value | Count | Share |
|---|---:|---:|
| Jazz | 3 | 21.4% |
| Ufone | 3 | 21.4% |
| Telenor | 3 | 21.4% |
| Jazz (ex-Warid) | 2 | 14.3% |
| Zong | 2 | 14.3% |
| landline / non-mobile | 1 | 7.1% |

## Program (top 15)

| Value | Count | Share |
|---|---:|---:|
| BS Computer Science | 2 | 11.8% |
| BBA | 1 | 5.9% |
| BS Psychology | 1 | 5.9% |
| BS Electrical Engineering | 1 | 5.9% |
| BS Mathematics | 1 | 5.9% |
| BS Civil Engineering | 1 | 5.9% |
| Pharm-D | 1 | 5.9% |
| BS Architecture | 1 | 5.9% |
| MBBS | 1 | 5.9% |
| BS English | 1 | 5.9% |
| BS Accounting & Finance | 1 | 5.9% |
| LLB | 1 | 5.9% |
| BS Nursing | 1 | 5.9% |
| BS Software Engineering | 1 | 5.9% |
| MS Data Science | 1 | 5.9% |

## Row-level issues

| Row | Severity | Field | Problem | Value |
|---:|---|---|---|---|
| 10 | warning | phone | international | +9715*****567 |
| 11 | warning | phone | international | +9665*****567 |
| 12 | warning | gender | missing |  |
| 13 | warning | phone | landline | 0423****234 |
| 15 | REJECTED | name | missing |  |
| 16 | REJECTED | phone | invalid | ***** |
| 20 | warning | phone | international | +4479*****456 |
| 21 | warning | gender | unrecognised | X |
| 21 | warning | preferredLanguage | unrecognised | Klingon |
| 14 | duplicate | phone | same number as row 2 | +9230*****567 |

## Estimated campaign cost for this file (Option B)

17 callable applicants, 17.6% international → **$114 / PKR 31,640** (fixed monthly costs included; see docs/01-cost-estimate.md for assumptions).

## Cleaning rules applied

1. Header names matched loosely (case/spacing/aliases — see `src/ingest/parseDataset.ts`).
2. Phones: spaces/dashes removed; `00` → `+`; `92…` and `3xxxxxxxxx` repaired; parsed as Pakistani by default; converted to E.164.
3. Rows with no name or no valid phone are **rejected** and listed above — fix at source and re-upload.
4. Repeated phone numbers: first row kept, later rows dropped as duplicates (siblings sharing a parent's phone appear here — review manually).
5. Gender F/Female/M/Male (and Urdu equivalents) recognised; anything else → default persona (config `defaultPersonaWhenUnknown`).
6. Language names/codes in English, Urdu script and ISO codes recognised; blank → language chosen by country and auto-detected in the call.
