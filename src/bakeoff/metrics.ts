/**
 * Accuracy metrics for the STT bake-off. Arabic-script languages (Urdu, Punjabi Shahmukhi,
 * Sindhi, Pashto, Arabic) are normalised so that equivalent spellings and diacritics are
 * not counted as errors — we care whether the words were recognised, not orthography.
 */

const ARABIC_DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g; // harakat, superscript alef, Quranic marks, tatweel
const PUNCTUATION = /[\p{P}\p{S}]/gu;

const LETTER_VARIANTS: [RegExp, string][] = [
  [/[يى]/g, "ی"], // Arabic yeh / alef maksura → Farsi/Urdu yeh
  [/ك/g, "ک"], // Arabic kaf → keheh
  [/ە/g, "ہ"], // ae → heh goal
  [/[أإآٱ]/g, "ا"], // alef variants
  [/ۀ/g, "ہ"],
  [/[ۓ]/g, "ے"],
];

export function normalizeText(s: string): string {
  let t = s.normalize("NFC").toLowerCase().replace(ARABIC_DIACRITICS, "");
  for (const [re, rep] of LETTER_VARIANTS) t = t.replace(re, rep);
  // Devanagari nukta: treat फ़ and फ as the same letter.
  t = t.normalize("NFD").replace(/़/g, "").normalize("NFC");
  return t.replace(PUNCTUATION, " ").replace(/\s+/g, " ").trim();
}

export function editDistance<T>(a: T[], b: T[]): number {
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Word error rate: word edits / reference words. */
export function wer(reference: string, hypothesis: string): number {
  const r = normalizeText(reference).split(" ").filter(Boolean);
  const h = normalizeText(hypothesis).split(" ").filter(Boolean);
  if (!r.length) return h.length ? 1 : 0;
  return editDistance(r, h) / r.length;
}

/** Character error rate (spaces ignored) — fairer than WER for languages with inconsistent word spacing. */
export function cer(reference: string, hypothesis: string): number {
  const r = [...normalizeText(reference).replace(/ /g, "")];
  const h = [...normalizeText(hypothesis).replace(/ /g, "")];
  if (!r.length) return h.length ? 1 : 0;
  return editDistance(r, h) / r.length;
}
