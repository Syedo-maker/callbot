// Phase 0, item 6 — STT/TTS provider bake-off.
//
//   npm run bakeoff -- check       validate phrase set + candidates, show which API keys are present (no API calls)
//   npm run bakeoff -- tts         synthesize agent lines per provider/voice/language → bakeoff/out/tts/ + scoring sheet
//   npm run bakeoff -- stt         transcribe native-speaker recordings in bakeoff/recordings/<lang>/<speaker>_<phraseId>.<ext>
//   npm run bakeoff -- roundtrip   machine sanity check: TTS the student lines, then STT them back, score CER
//
// Keys are read from .env (ELEVENLABS_API_KEY, DEEPGRAM_API_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cer, wer } from "../src/bakeoff/metrics.ts";
import { hasCredentials, synthesize, transcribe, voiceFor, type SttCandidate, type TtsCandidate } from "../src/bakeoff/providers.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

interface Phrase { id: string; kind: "student" | "agent"; en: string }
const phrasesFile = JSON.parse(await readFile("bakeoff/test-phrases.json", "utf8")) as {
  phrases: Phrase[];
  translations: Record<string, Record<string, string>>;
};
const candidates = JSON.parse(await readFile("bakeoff/candidates.json", "utf8")) as { stt: SttCandidate[]; tts: TtsCandidate[] };
const LANGS = Object.keys(phrasesFile.translations);
const OUT = "bakeoff/out";

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\n") + "\n";
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x: number) => (Number.isNaN(x) ? "—" : `${(100 * x).toFixed(1)}%`);

async function check() {
  let problems = 0;
  for (const lang of LANGS) {
    const missing = phrasesFile.phrases.filter((p) => !phrasesFile.translations[lang]?.[p.id]).map((p) => p.id);
    if (missing.length) {
      problems++;
      console.log(`✗ ${lang}: missing ${missing.join(", ")}`);
    } else console.log(`✓ ${lang}: ${phrasesFile.phrases.length} phrases`);
  }
  console.log("\nCandidates:");
  for (const c of [...candidates.stt.map((c) => ({ ...c, kind: "STT" })), ...candidates.tts.map((c) => ({ ...c, kind: "TTS" }))]) {
    const ready = c.provider === "manual" ? "manual" : hasCredentials(c.provider) ? "key ✓" : "key missing";
    console.log(`  ${c.kind} ${c.id.padEnd(20)} ${ready.padEnd(12)} ${c.languages.join(" ")}`);
  }
  const recDir = "bakeoff/recordings";
  const recs = existsSync(recDir) ? (await readdir(recDir, { recursive: true })).filter((f) => /\.(wav|mp3|m4a|ogg|webm)$/i.test(String(f))) : [];
  console.log(`\nRecordings found: ${recs.length} (expected layout: ${recDir}/<lang>/<speaker>_<phraseId>.wav)`);
  if (problems) process.exitCode = 1;
}

async function tts() {
  const agentLines = phrasesFile.phrases.filter((p) => p.kind === "agent");
  const latency: (string | number)[][] = [["candidate", "language", "gender", "voice", "phrase", "latency_ms", "file"]];
  const scoring: (string | number)[][] = [
    ["file", "candidate", "language", "gender", "phrase", "naturalness_1to5", "pronunciation_1to5", "gender_voice_ok_yn", "reviewer", "notes"],
  ];
  for (const c of candidates.tts) {
    if (c.provider === "manual") {
      console.log(`- ${c.id}: manual — place samples in ${OUT}/tts/${c.id}/`);
      continue;
    }
    if (!hasCredentials(c.provider)) {
      console.log(`- ${c.id}: skipped (no API key)`);
      continue;
    }
    for (const lang of c.languages) {
      for (const gender of ["female", "male"] as const) {
        const voice = voiceFor(c, gender, lang);
        if (!voice || voice.startsWith("TBD")) continue;
        const dir = join(OUT, "tts", c.id, lang);
        await mkdir(dir, { recursive: true });
        for (const p of agentLines) {
          const text = phrasesFile.translations[lang]?.[p.id];
          if (!text) continue;
          try {
            const r = await synthesize(c, text, voice, lang);
            const file = join(dir, `${gender}_${p.id}.${r.ext}`);
            await writeFile(file, r.audio);
            latency.push([c.id, lang, gender, voice, p.id, r.latencyMs, file]);
            scoring.push([file, c.id, lang, gender, p.id, "", "", "", "", ""]);
            console.log(`✓ ${c.id} ${lang} ${gender} ${p.id} ${r.latencyMs} ms`);
          } catch (e) {
            console.log(`✗ ${c.id} ${lang} ${gender} ${p.id}: ${(e as Error).message}`);
          }
        }
      }
    }
  }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "tts-latency.csv"), csv(latency));
  await writeFile(join(OUT, "tts-scoring.csv"), csv(scoring));
  console.log(`\nWrote ${OUT}/tts-latency.csv and ${OUT}/tts-scoring.csv (fill in scores with native reviewers).`);
}

async function scoreStt(jobs: { lang: string; speaker: string; phraseId: string; file: string; audio: Uint8Array<ArrayBuffer> }[], label: string) {
  const rows: (string | number)[][] = [["candidate", "language", "speaker", "phrase", "reference", "hypothesis", "cer", "wer", "latency_ms"]];
  const agg = new Map<string, { cer: number[]; wer: number[]; lat: number[] }>();
  for (const c of candidates.stt) {
    if (!hasCredentials(c.provider)) {
      console.log(`- ${c.id}: skipped (no API key)`);
      continue;
    }
    for (const j of jobs) {
      if (!c.languages.includes(j.lang)) continue;
      const ref = phrasesFile.translations[j.lang]?.[j.phraseId];
      if (!ref) continue;
      try {
        const r = await transcribe(c, j.audio, j.file, j.lang);
        const e = { cer: cer(ref, r.text), wer: wer(ref, r.text) };
        rows.push([c.id, j.lang, j.speaker, j.phraseId, ref, r.text, e.cer.toFixed(3), e.wer.toFixed(3), r.latencyMs]);
        const key = `${c.id}|${j.lang}`;
        const a = agg.get(key) ?? { cer: [], wer: [], lat: [] };
        a.cer.push(e.cer);
        a.wer.push(e.wer);
        a.lat.push(r.latencyMs);
        agg.set(key, a);
        console.log(`✓ ${c.id} ${j.lang} ${j.speaker} ${j.phraseId} CER ${fmt(e.cer)}`);
      } catch (err) {
        console.log(`✗ ${c.id} ${j.file}: ${(err as Error).message}`);
      }
    }
  }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, `${label}-results.csv`), csv(rows));
  const md = [
    `# STT ${label} summary`,
    "",
    "| Candidate | Language | Samples | Mean CER | Mean WER | Mean latency |",
    "|---|---|---:|---:|---:|---:|",
    ...[...agg.entries()].map(([k, a]) => {
      const [cand, lang] = k.split("|");
      return `| ${cand} | ${lang} | ${a.cer.length} | ${fmt(mean(a.cer))} | ${fmt(mean(a.wer))} | ${Math.round(mean(a.lat))} ms |`;
    }),
  ].join("\n");
  await writeFile(join(OUT, `${label}-summary.md`), md + "\n");
  console.log(`\n${md}\n\nWrote ${OUT}/${label}-results.csv and ${label}-summary.md`);
}

async function stt() {
  const root = "bakeoff/recordings";
  if (!existsSync(root)) {
    console.log(`No ${root}/ folder. Record native speakers as ${root}/<lang>/<speaker>_<phraseId>.wav (see docs/phase-0/0.3-provider-bakeoff.md).`);
    return;
  }
  const jobs = [];
  for (const lang of await readdir(root)) {
    if (!LANGS.includes(lang)) continue;
    for (const f of await readdir(join(root, lang))) {
      const m = /^(.+)_(S\d+)\.(wav|mp3|m4a|ogg|webm)$/i.exec(f);
      if (!m) continue;
      jobs.push({ lang, speaker: m[1]!, phraseId: m[2]!.toUpperCase(), file: f, audio: new Uint8Array(await readFile(join(root, lang, f))) });
    }
  }
  console.log(`${jobs.length} recordings found.`);
  await scoreStt(jobs, "stt");
}

async function roundtrip() {
  const synth = candidates.tts.find((c) => c.provider !== "manual" && hasCredentials(c.provider));
  if (!synth) {
    console.log("No TTS candidate with an API key — cannot run round-trip.");
    return;
  }
  const jobs = [];
  for (const lang of synth.languages) {
    const voice = voiceFor(synth, "male", lang);
    if (!voice || voice.startsWith("TBD")) continue;
    for (const p of phrasesFile.phrases.filter((x) => x.kind === "student")) {
      const text = phrasesFile.translations[lang]?.[p.id];
      if (!text) continue;
      try {
        const r = await synthesize(synth, text, voice, lang);
        jobs.push({ lang, speaker: `tts-${synth.id}`, phraseId: p.id, file: `${p.id}.${r.ext}`, audio: r.audio });
      } catch (e) {
        console.log(`✗ synth ${lang} ${p.id}: ${(e as Error).message}`);
      }
    }
  }
  await scoreStt(jobs, "roundtrip");
}

const cmd = process.argv[2] ?? "check";
const commands: Record<string, () => Promise<void>> = { check, tts, stt, roundtrip };
if (!commands[cmd]) {
  console.error(`Unknown command "${cmd}". Use: check | tts | stt | roundtrip`);
  process.exit(1);
}
await commands[cmd]();
