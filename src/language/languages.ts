import type { LanguageCode } from "../types.ts";

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  script: "Arabic" | "Latin" | "Devanagari";
  /** Launch = supported on day one; pilot = human fallback ready; fallback = route to Urdu/human. */
  tier: "launch" | "pilot" | "fallback";
}

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  ur: { code: "ur", name: "Urdu", nativeName: "اردو", script: "Arabic", tier: "launch" },
  en: { code: "en", name: "English", nativeName: "English", script: "Latin", tier: "launch" },
  pa: { code: "pa", name: "Punjabi", nativeName: "پنجابی", script: "Arabic", tier: "launch" },
  sd: { code: "sd", name: "Sindhi", nativeName: "سنڌي", script: "Arabic", tier: "launch" },
  ps: { code: "ps", name: "Pashto", nativeName: "پښتو", script: "Arabic", tier: "pilot" },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", script: "Arabic", tier: "launch" },
  hi: { code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari", tier: "launch" },
  skr: { code: "skr", name: "Saraiki", nativeName: "سرائیکی", script: "Arabic", tier: "fallback" },
  bal: { code: "bal", name: "Balochi", nativeName: "بلوچی", script: "Arabic", tier: "fallback" },
  hno: { code: "hno", name: "Hindko", nativeName: "ہندکو", script: "Arabic", tier: "fallback" },
};

const ALIASES: Record<string, LanguageCode> = {
  urdu: "ur", ur: "ur", urd: "ur", "اردو": "ur",
  english: "en", en: "en", eng: "en", angrezi: "en",
  punjabi: "pa", panjabi: "pa", pa: "pa", pnb: "pa", "پنجابی": "pa",
  sindhi: "sd", sd: "sd", snd: "sd", "سنڌي": "sd", "سندھی": "sd",
  pashto: "ps", pushto: "ps", pakhto: "ps", pukhto: "ps", ps: "ps", pus: "ps", "پښتو": "ps", "پشتو": "ps",
  arabic: "ar", ar: "ar", ara: "ar", "العربية": "ar", "عربی": "ar",
  hindi: "hi", hi: "hi", hin: "hi", "हिन्दी": "hi", "हिंदी": "hi",
  saraiki: "skr", seraiki: "skr", siraiki: "skr", skr: "skr", "سرائیکی": "skr",
  balochi: "bal", baluchi: "bal", bal: "bal", "بلوچی": "bal",
  hindko: "hno", hno: "hno", "ہندکو": "hno",
};

/** Maps free-text language values from admissions exports to a code. Returns undefined if unknown or blank. */
export function normalizeLanguage(raw: string | undefined | null): LanguageCode | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  if (!key) return undefined;
  return ALIASES[key];
}
