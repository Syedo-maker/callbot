import { campaignCost, defaultVolume, options, pkr, usd } from "../cost/costModel.ts";
import { LANGUAGES } from "../language/languages.ts";
import type { ParseResult } from "./parseDataset.ts";

/** Pakistani mobile prefix → network, for checking we test on every network in Phase 1. */
export function pkNetwork(e164: string): string {
  const m = /^\+92(3\d{2})/.exec(e164);
  if (!m) return "landline / non-mobile";
  const p = Number(m[1]);
  if (p >= 300 && p <= 309) return "Jazz";
  if (p >= 320 && p <= 329) return "Jazz (ex-Warid)";
  if (p >= 310 && p <= 319) return "Zong";
  if (p >= 330 && p <= 339) return "Ufone";
  if (p >= 340 && p <= 349) return "Telenor";
  if (p === 355) return "SCOM";
  return "other";
}

/** Keeps the first 4 and last 3 digits: +923001234567 → +9230*****567. */
export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (digits.length < 8) return "*".repeat(digits.length);
  return (v.trim().startsWith("+") ? "+" : "") + digits.slice(0, 4) + "*".repeat(digits.length - 7) + digits.slice(-3);
}

function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");

export interface AuditSummary {
  totalRows: number;
  callable: number;
  rejected: number;
  duplicates: number;
  missingGender: number;
  missingLanguage: number;
  international: number;
  landline: number;
}

export function summarize(r: ParseResult): AuditSummary {
  return {
    totalRows: r.totalRows,
    callable: r.applicants.length,
    rejected: r.rejected.length,
    duplicates: r.duplicates.length,
    missingGender: r.applicants.filter((a) => a.gender === "unknown").length,
    missingLanguage: r.applicants.filter((a) => !a.preferredLanguage).length,
    international: r.applicants.filter((a) => a.country !== "PK").length,
    landline: r.warnings.filter((w) => w.field === "phone" && w.problem === "landline").length,
  };
}

/** Markdown data-quality report. Phone values are masked so the report is safe to share internally. */
export function auditReport(r: ParseResult, sourceName: string, generatedAt = new Date()): string {
  const s = summarize(r);
  const out: string[] = [];
  const p = (line = "") => out.push(line);

  p(`# Data Audit Report — ${sourceName}`);
  p();
  p(`Generated ${generatedAt.toISOString()} by \`npm run audit\`.`);
  p();

  if (r.missingHeaders.length) {
    p(`> ⚠️ **Missing required columns:** ${r.missingHeaders.join(", ")}. Found columns: ${Object.keys(r.headerMapping).length ? Object.entries(r.headerMapping).map(([f, h]) => `${f}←"${h}"`).join(", ") : "none recognised"}.`);
    p();
  }

  p("## Summary");
  p();
  p("| Check | Count | Share |");
  p("|---|---:|---:|");
  p(`| Rows in file | ${s.totalRows} | 100% |`);
  p(`| **Callable applicants** | **${s.callable}** | ${pct(s.callable, s.totalRows)} |`);
  p(`| Rejected (no name / no valid phone) | ${s.rejected} | ${pct(s.rejected, s.totalRows)} |`);
  p(`| Duplicate phone numbers (dropped) | ${s.duplicates} | ${pct(s.duplicates, s.totalRows)} |`);
  p(`| Gender missing/unrecognised → default persona | ${s.missingGender} | ${pct(s.missingGender, s.callable)} of callable |`);
  p(`| Preferred language missing → auto-detect | ${s.missingLanguage} | ${pct(s.missingLanguage, s.callable)} of callable |`);
  p(`| International numbers | ${s.international} | ${pct(s.international, s.callable)} of callable |`);
  p(`| Pakistani landlines | ${s.landline} | ${pct(s.landline, s.callable)} of callable |`);
  p();

  p("## Column mapping");
  p();
  p("| Field | Column in file |");
  p("|---|---|");
  for (const f of ["id", "name", "phone", "gender", "program", "preferredLanguage"]) {
    p(`| ${f} | ${r.headerMapping[f] ? `"${r.headerMapping[f]}"` : "— not found"} |`);
  }
  p();

  const table = (title: string, rows: [string, number][], total: number) => {
    p(`## ${title}`);
    p();
    p("| Value | Count | Share |");
    p("|---|---:|---:|");
    for (const [k, n] of rows) p(`| ${k} | ${n} | ${pct(n, total)} |`);
    p();
  };

  table("Gender", countBy(r.applicants, (a) => a.gender), s.callable);
  table(
    "Preferred language",
    countBy(r.applicants, (a) => (a.preferredLanguage ? `${LANGUAGES[a.preferredLanguage].name} (${a.preferredLanguage})` : "not given")),
    s.callable,
  );
  table("Country of phone number", countBy(r.applicants, (a) => a.country), s.callable);
  table("Pakistani mobile network", countBy(r.applicants.filter((a) => a.country === "PK"), (a) => pkNetwork(a.phone)), s.callable - s.international);
  table("Program (top 15)", countBy(r.applicants, (a) => a.program || "not given").slice(0, 15), s.callable);

  const issues = [...r.rejected.map((x) => ({ ...x, kind: "REJECTED" })), ...r.warnings.map((x) => ({ ...x, kind: "warning" }))].sort(
    (a, b) => a.row - b.row,
  );
  p("## Row-level issues");
  p();
  if (!issues.length && !r.duplicates.length) p("None.");
  else {
    p("| Row | Severity | Field | Problem | Value |");
    p("|---:|---|---|---|---|");
    for (const x of issues.slice(0, 200)) {
      const v = x.field === "phone" ? maskPhone(x.value) : x.value;
      p(`| ${x.row} | ${x.kind} | ${x.field} | ${x.problem} | ${v.replace(/\|/g, "\\|")} |`);
    }
    for (const d of r.duplicates.slice(0, 100)) {
      p(`| ${d.row} | duplicate | phone | same number as row ${d.duplicateOfRow} | ${maskPhone(d.phone)} |`);
    }
    if (issues.length > 200) p(`\n…and ${issues.length - 200} more issues.`);
  }
  p();

  const intlShare = s.callable ? s.international / s.callable : 0;
  const cost = campaignCost(options[1]!, { ...defaultVolume, students: s.callable, internationalShare: intlShare });
  p("## Estimated campaign cost for this file (Option B)");
  p();
  p(`${s.callable} callable applicants, ${pct(s.international, s.callable)} international → **${usd(cost.total)} / ${pkr(cost.total)}** (fixed monthly costs included; see docs/01-cost-estimate.md for assumptions).`);
  p();

  p("## Cleaning rules applied");
  p();
  p("1. Header names matched loosely (case/spacing/aliases — see `src/ingest/parseDataset.ts`).");
  p("2. Phones: spaces/dashes removed; `00` → `+`; `92…` and `3xxxxxxxxx` repaired; parsed as Pakistani by default; converted to E.164.");
  p("3. Rows with no name or no valid phone are **rejected** and listed above — fix at source and re-upload.");
  p("4. Repeated phone numbers: first row kept, later rows dropped as duplicates (siblings sharing a parent's phone appear here — review manually).");
  p("5. Gender F/Female/M/Male (and Urdu equivalents) recognised; anything else → default persona (config `defaultPersonaWhenUnknown`).");
  p("6. Language names/codes in English, Urdu script and ISO codes recognised; blank → language chosen by country and auto-detected in the call.");
  return out.join("\n");
}
