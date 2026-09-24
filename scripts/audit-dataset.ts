// Data-quality audit for an admissions export (Phase 0, item 5).
// Usage: npm run audit -- <file.csv|file.xlsx> [--out report.md]
// Real exports and their reports belong in data/ (git-ignored), never in the repo.
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { auditReport, summarize } from "../src/ingest/audit.ts";
import { parseDataset } from "../src/ingest/parseDataset.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" } },
});

const input = positionals[0];
if (!input) {
  console.error("Usage: npm run audit -- <file.csv|file.xlsx> [--out report.md]");
  process.exit(1);
}

const result = await parseDataset(input);
const report = auditReport(result, basename(input));
if (values.out) {
  await writeFile(values.out, report + "\n", "utf8");
  console.log(`Report written to ${values.out}`);
} else {
  console.log(report);
}
const s = summarize(result);
console.error(`\n${s.callable}/${s.totalRows} callable · ${s.rejected} rejected · ${s.duplicates} duplicates · ${s.missingGender} unknown gender`);
