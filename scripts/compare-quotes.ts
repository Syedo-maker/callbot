// Phase 0, item 7 — turn carrier quotes into per-campaign telephony cost.
// Usage: npm run quotes [-- carriers/quotes.csv]
// Rows with an empty rate are skipped. Uses the campaign volume from src/cost/costModel.ts.
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { computeVolume, defaultVolume, USD_TO_PKR } from "../src/cost/costModel.ts";

const file = process.argv[2] ?? "carriers/quotes.csv";
const rows = parse(await readFile(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];

const vol = computeVolume();
const pkShare = 1 - defaultVolume.internationalShare;
const connected = vol.connected;
const billedUnanswered = vol.unansweredAttempts * defaultVolume.unansweredBilledShare;

/** Billed minutes for one call of `sec` seconds with the given billing increment. */
const billed = (sec: number, inc: number) => (Math.ceil(sec / inc) * inc) / 60;

const out: string[] = [
  `Campaign: ${connected.toLocaleString()} connected calls × ${defaultVolume.avgTalkMinutes} min, ${Math.round(billedUnanswered).toLocaleString()} billed unanswered, ${Math.round(pkShare * 100)}% Pakistani numbers.`,
  "",
  "| Carrier | Rate (PKR/min, mobile) | Billing | Channels | Usage PKR | Fixed PKR (1 month + setup) | **Campaign total PKR** | USD | AI calling OK | UAN caller ID |",
  "|---|---:|---|---:|---:|---:|---:|---:|---|---|",
];

const results = [];
for (const r of rows) {
  const rate = Number(r.rate_pkr_per_min_mobile);
  if (!r.rate_pkr_per_min_mobile || Number.isNaN(rate)) continue;
  const inc = Number(r.billing_increment_sec) || 60;
  const minutes = pkShare * (connected * billed(defaultVolume.avgTalkMinutes * 60, inc) + billedUnanswered * billed(20, inc));
  const usage = minutes * rate;
  const fixed = (Number(r.setup_fee_pkr) || 0) + (Number(r.monthly_rental_pkr) || 0);
  const total = usage + fixed;
  results.push({ r, rate, inc, usage, fixed, total });
}
results.sort((a, b) => a.total - b.total);
for (const x of results) {
  out.push(
    `| ${x.r.carrier} | ${x.rate} | ${x.inc}/${x.inc} s | ${x.r.channels_included || "?"} | ${Math.round(x.usage).toLocaleString()} | ${Math.round(x.fixed).toLocaleString()} | **${Math.round(x.total).toLocaleString()}** | $${Math.round(x.total / USD_TO_PKR).toLocaleString()} | ${x.r.ai_calling_permitted_in_writing || "?"} | ${x.r.uan_caller_id || "?"} |`,
  );
}
if (!results.length) out.push("| (no quotes with a rate yet) | | | | | | | | | |");
out.push("", "Reject any carrier without written permission for AI-assisted outbound calls, or that cannot present the university UAN as caller ID.");
console.log(out.join("\n"));
