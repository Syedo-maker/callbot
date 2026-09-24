import { readFileSync } from "node:fs";
import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const language = z.enum(["ur", "en", "pa", "ps", "sd", "ar", "hi", "skr", "bal", "hno"]);

export const CampaignConfigSchema = z.object({
  name: z.string(),
  universityName: z.string(),
  maxConcurrency: z.number().int().positive(),
  maxDurationSeconds: z.number().int().positive(),
  softLimitSeconds: z.number().int().positive(),
  maxOffTopicRedirects: z.number().int().min(1).max(5),
  defaultLanguage: language,
  defaultLanguageInternational: language,
  defaultPersonaWhenUnknown: z.enum(["female", "male"]),
  retry: z.object({
    maxAttempts: z.number().int().min(1),
    gapsMinutes: z.array(z.number().positive()),
    callbackDefaultGapMinutes: z.number().positive(),
  }),
  callingWindows: z.object({
    days: z.array(z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"])),
    windows: z.array(z.object({ start: hhmm, end: hhmm })),
  }),
  disclosure: z.object({
    default: z.enum(["on_ask", "upfront"]),
    upfrontCountries: z.array(z.string().length(2)),
  }),
  classifier: z.object({ minConfidence: z.number().min(0).max(1) }),
  facts: z.array(z.string()),
});
export type CampaignConfig = z.infer<typeof CampaignConfigSchema>;

const VoiceSchema = z.object({ provider: z.string(), voiceId: z.string(), model: z.string().optional() });

export const PersonaConfigSchema = z.object({
  name: z.string(),
  nameByLanguage: z.record(z.string(), z.string()),
});
export const PersonasSchema = z.object({ female: PersonaConfigSchema, male: PersonaConfigSchema });
export type PersonasConfig = z.infer<typeof PersonasSchema>;

export const VoiceStackSchema = z.object({
  model: z.object({ provider: z.string(), model: z.string() }),
  transcriber: z.object({ provider: z.string(), model: z.string(), language: z.string().optional() }),
  voices: z.object({ female: VoiceSchema, male: VoiceSchema }),
  silenceTimeoutSeconds: z.number().int().positive(),
  recordingEnabled: z.boolean(),
  voicemailDetection: z.boolean(),
  phoneNumbers: z.object({ pakistan: z.string(), international: z.string() }),
});
export type VoiceStack = z.infer<typeof VoiceStackSchema>;

function loadJson<T>(schema: z.ZodType<T>, path: string): T {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid config ${path}:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  return parsed.data;
}

export const loadCampaignConfig = (path = "config/campaign.example.json") => loadJson(CampaignConfigSchema, path);
export const loadPersonas = (path = "config/personas.json") => loadJson(PersonasSchema, path);
export const loadVoiceStack = (path = "config/voice-stack.json") => loadJson(VoiceStackSchema, path);

/** Resolves "env:NAME" indirections so IDs and secrets live in .env, not in committed config. */
export function resolveEnv(value: string): string | undefined {
  return value.startsWith("env:") ? process.env[value.slice(4)] || undefined : value;
}
