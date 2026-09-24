import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { normalizeLanguage } from "../language/languages.ts";
import type { Applicant, Gender } from "../types.ts";

export type RawRow = Record<string, string>;

/** Canonical field → accepted header spellings (compared after lower-casing and stripping non-alphanumerics). */
const HEADER_ALIASES: Record<string, string[]> = {
  id: ["id", "applicantid", "applicationno", "applicationnumber", "rollno", "formno", "regno"],
  name: ["name", "studentname", "applicantname", "fullname", "candidatename"],
  phone: ["phone", "mobile", "phonenumber", "mobilenumber", "mobileno", "contact", "contactno", "contactnumber", "cell", "cellno", "whatsapp"],
  gender: ["gender", "sex"],
  program: ["program", "programme", "degree", "course", "discipline", "admittedprogram"],
  preferredLanguage: ["preferredlanguage", "language", "lang", "motherlanguage", "mothertongue"],
};

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapHeaders(headers: string[]): { mapping: Record<string, string>; missing: string[] } {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const k = headerKey(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!mapping[field] && aliases.includes(k)) mapping[field] = h;
    }
  }
  const missing = ["name", "phone", "gender", "program"].filter((f) => !mapping[f]);
  return { mapping, missing };
}

export function normalizeGender(raw: string | undefined): Gender | undefined {
  const g = (raw ?? "").trim().toLowerCase();
  if (!g) return undefined;
  if (["f", "female", "woman", "girl", "fem", "mrs", "miss", "ms", "خاتون", "عورت", "لڑکی"].includes(g)) return "female";
  if (["m", "male", "man", "boy", "mr", "مرد", "لڑکا"].includes(g)) return "male";
  return "unknown";
}

export type PhoneIssue = "missing" | "invalid" | "landline" | "international";

export interface PhoneCheck {
  e164?: string;
  country?: string;
  type?: string;
  issue?: PhoneIssue;
}

/** Normalises a phone number, treating bare local numbers as Pakistani. */
export function normalizePhone(raw: string | undefined): PhoneCheck {
  let s = (raw ?? "").trim();
  if (!s) return { issue: "missing" };
  // Excel often turns 03001234567 into 3001234567 or 923001234567 into a float-looking string.
  s = s.replace(/\.0+$/, "").replace(/[^\d+]/g, "");
  if (/^00/.test(s)) s = "+" + s.slice(2);
  if (/^92\d{10}$/.test(s)) s = "+" + s;
  if (/^3\d{9}$/.test(s)) s = "0" + s;
  const p = parsePhoneNumberFromString(s, "PK");
  if (!p || !p.isValid()) return { issue: "invalid" };
  const type = p.getType();
  const result: PhoneCheck = { e164: p.number, country: p.country ?? "unknown", type };
  if (p.country !== "PK") result.issue = "international";
  else if (type === "FIXED_LINE") result.issue = "landline";
  return result;
}

export async function readRows(path: string): Promise<RawRow[]> {
  const ext = extname(path).toLowerCase();
  if (ext === ".csv" || ext === ".txt") {
    const text = await readFile(path, "utf8");
    return parseCsv(text.replace(/^﻿/, ""), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as RawRow[];
  }
  if (ext === ".xlsx") {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = cellText(cell.value).trim();
    });
    const rows: RawRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const r: RawRow = {};
      headers.forEach((h, i) => {
        if (h) r[h] = cellText(row.getCell(i + 1).value).trim();
      });
      if (Object.values(r).some((v) => v !== "")) rows.push(r);
    });
    return rows;
  }
  throw new Error(`Unsupported file type "${ext}". Use .csv or .xlsx.`);
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return String(v.result ?? "");
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

export interface RowProblem {
  row: number; // 1-based data row (header = row 1, first data row = 2)
  field: string;
  problem: string;
  value: string;
}

export interface ParseResult {
  applicants: Applicant[];
  rejected: RowProblem[];
  warnings: RowProblem[];
  duplicates: { row: number; duplicateOfRow: number; phone: string }[];
  headerMapping: Record<string, string>;
  missingHeaders: string[];
  totalRows: number;
}

/** Validates rows into applicants. Rows missing a callable phone or a name are rejected; everything else is a warning. */
export function validateRows(rows: RawRow[]): ParseResult {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const { mapping, missing } = mapHeaders(headers);
  const result: ParseResult = {
    applicants: [],
    rejected: [],
    warnings: [],
    duplicates: [],
    headerMapping: mapping,
    missingHeaders: missing,
    totalRows: rows.length,
  };
  if (missing.includes("name") || missing.includes("phone")) return result;

  const mappedCols = new Set(Object.values(mapping));
  const seenPhones = new Map<string, number>();

  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const get = (f: string) => (mapping[f] ? (r[mapping[f]!] ?? "").trim() : "");
    const name = get("name");
    const phoneRaw = get("phone");

    if (!name) {
      result.rejected.push({ row: rowNo, field: "name", problem: "missing", value: "" });
      return;
    }
    const phone = normalizePhone(phoneRaw);
    if (!phone.e164) {
      result.rejected.push({ row: rowNo, field: "phone", problem: phone.issue ?? "invalid", value: phoneRaw });
      return;
    }
    if (phone.issue === "landline" || phone.issue === "international") {
      result.warnings.push({ row: rowNo, field: "phone", problem: phone.issue, value: phoneRaw });
    }
    const firstRow = seenPhones.get(phone.e164);
    if (firstRow !== undefined) {
      result.duplicates.push({ row: rowNo, duplicateOfRow: firstRow, phone: phone.e164 });
      return;
    }
    seenPhones.set(phone.e164, rowNo);

    const genderRaw = get("gender");
    const gender = normalizeGender(genderRaw);
    if (!gender || gender === "unknown") {
      result.warnings.push({ row: rowNo, field: "gender", problem: gender ? "unrecognised" : "missing", value: genderRaw });
    }
    const program = get("program");
    if (!program) result.warnings.push({ row: rowNo, field: "program", problem: "missing", value: "" });

    const langRaw = get("preferredLanguage");
    const preferredLanguage = normalizeLanguage(langRaw);
    if (langRaw && !preferredLanguage) {
      result.warnings.push({ row: rowNo, field: "preferredLanguage", problem: "unrecognised", value: langRaw });
    }

    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) if (!mappedCols.has(k)) extra[k] = v;

    result.applicants.push({
      id: get("id") || `row-${rowNo}`,
      name,
      gender: gender ?? "unknown",
      phone: phone.e164,
      country: phone.country ?? "unknown",
      program,
      ...(preferredLanguage ? { preferredLanguage } : {}),
      extra,
    });
  });
  return result;
}

export async function parseDataset(path: string): Promise<ParseResult> {
  return validateRows(await readRows(path));
}
