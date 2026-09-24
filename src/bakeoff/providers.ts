/**
 * Thin REST clients for the Phase 0 bake-off. Deliberately minimal: they exist to compare
 * providers, not to run calls (in production the voice platform calls STT/TTS itself).
 * Verify endpoints/model names against each provider's current docs before a run.
 */

export interface SttCandidate {
  id: string;
  provider: "elevenlabs" | "deepgram";
  model: string;
  languages: string[];
}

export interface TtsCandidate {
  id: string;
  provider: "elevenlabs" | "azure" | "manual";
  model?: string;
  voices?: Record<"female" | "male", Record<string, string>>;
  languages: string[];
}

export const REQUIRED_ENV: Record<string, string[]> = {
  elevenlabs: ["ELEVENLABS_API_KEY"],
  deepgram: ["DEEPGRAM_API_KEY"],
  azure: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
  manual: [],
};

export function hasCredentials(provider: string): boolean {
  return (REQUIRED_ENV[provider] ?? ["__missing__"]).every((k) => !!process.env[k]);
}

const MIME: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", webm: "audio/webm" };
export const mimeFor = (filename: string) => MIME[filename.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export async function transcribe(c: SttCandidate, audio: Uint8Array<ArrayBuffer>, filename: string, language: string): Promise<{ text: string; latencyMs: number }> {
  const t0 = performance.now();
  let text: string;
  if (c.provider === "elevenlabs") {
    const form = new FormData();
    form.append("model_id", c.model);
    form.append("language_code", language);
    form.append("file", new Blob([audio], { type: mimeFor(filename) }), filename);
    const res = await ok(
      await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
        body: form,
      }),
      `ElevenLabs STT ${filename}`,
    );
    text = ((await res.json()) as { text?: string }).text ?? "";
  } else {
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(c.model)}&language=${encodeURIComponent(language)}&smart_format=true`;
    const res = await ok(
      await fetch(url, {
        method: "POST",
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": mimeFor(filename) },
        body: audio,
      }),
      `Deepgram STT ${filename}`,
    );
    const json = (await res.json()) as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
    text = json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  }
  return { text, latencyMs: Math.round(performance.now() - t0) };
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]!);

export async function synthesize(
  c: TtsCandidate,
  text: string,
  voice: string,
  language: string,
): Promise<{ audio: Uint8Array<ArrayBuffer>; latencyMs: number; ext: string }> {
  const t0 = performance.now();
  let res: Response;
  if (c.provider === "elevenlabs") {
    res = await ok(
      await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: c.model, language_code: language }),
      }),
      `ElevenLabs TTS ${voice}`,
    );
  } else if (c.provider === "azure") {
    const locale = voice.split("-").slice(0, 2).join("-");
    const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
    res = await ok(
      await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "callbot-bakeoff",
        },
        body: ssml,
      }),
      `Azure TTS ${voice}`,
    );
  } else {
    throw new Error(`Candidate ${c.id} is manual — generate its samples by hand.`);
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  return { audio, latencyMs: Math.round(performance.now() - t0), ext: "mp3" };
}

/** Voice for a language/gender, falling back to the candidate's "default" voice. */
export function voiceFor(c: TtsCandidate, gender: "female" | "male", language: string): string | undefined {
  const v = c.voices?.[gender];
  return v?.[language] ?? v?.default;
}
