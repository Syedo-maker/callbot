// Prints the cost tables used in docs/01-cost-estimate.md.  Run: npm run cost
import {
  campaignCost,
  computeVolume,
  defaultVolume,
  linesNeeded,
  llmCostPerMinute,
  options,
  pkr,
  prices,
  ttsAzurePerMinute,
  ttsElevenLabsPerMinute,
  usd,
  USD_TO_PKR,
  type LlmModel,
} from "../src/cost/costModel.ts";

const vol = computeVolume();
const out: string[] = [];
const p = (s = "") => out.push(s);

p(`## Volume (${defaultVolume.students.toLocaleString()} students)`);
p();
p("| Metric | Value |");
p("|---|---:|");
p(`| Call attempts (1st pass + ${defaultVolume.retryRounds} retry rounds) | ${vol.attempts.toLocaleString()} |`);
p(`| Connected conversations | ${vol.connected.toLocaleString()} |`);
p(`| Never reached after all attempts | ${vol.neverReached.toLocaleString()} |`);
p(`| AI minutes (STT/LLM/TTS running) | ${Math.round(vol.aiMinutes).toLocaleString()} |`);
p(`| Telephony minutes, 60/60 billing | ${Math.round(vol.telephonyMinutes60).toLocaleString()} |`);
p(`| Telephony minutes, per-second billing | ${Math.round(vol.telephonyMinutesPerSecond).toLocaleString()} |`);
p(`| Concurrent lines to finish in 10 days × 8 h | ${linesNeeded(80)} |`);
p(`| Concurrent lines to finish in 3 days × 8 h | ${linesNeeded(24)} |`);
p();

p("## Per-minute component prices");
p();
p("| Component | Option | USD / min |");
p("|---|---|---:|");
p(`| STT | ElevenLabs Scribe v2 Realtime | ${usd(prices.sttElevenLabsScribeRealtime)} |`);
p(`| STT | Deepgram Nova-3 Multilingual | ${usd(prices.sttDeepgramNova3Multilingual)} |`);
p(`| TTS | ElevenLabs Flash (~450 chars/min) | ${usd(ttsElevenLabsPerMinute())} |`);
p(`| TTS | Azure Neural (ur-PK Uzma/Asad) | ${usd(ttsAzurePerMinute())} |`);
for (const m of Object.keys(prices.llmPerMTok) as LlmModel[]) {
  p(`| LLM (in-call) | ${m} | ${usd(llmCostPerMinute(m))} |`);
}
p(`| Platform | Vapi | ${usd(prices.platformVapi)} |`);
p(`| Platform | Retell | ${usd(prices.platformRetell)} |`);
p(`| Telephony | Twilio → Pakistan mobile | ${usd(prices.twilioPakistanMobile)} |`);
p(`| Telephony | Local PK SIP trunk (ESTIMATE) | ${usd(prices.localPkSipPerMinute)} |`);
p(`| Telephony | International blend (Gulf/UK) | ${usd(prices.internationalBlended)} |`);
p();

p(`## Per-campaign cost by architecture (1 USD = ${USD_TO_PKR} PKR)`);
p();
const costs = options.map((o) => campaignCost(o));
for (const c of costs) {
  p(`### Option ${c.option.id} — ${c.option.name}`);
  p();
  p(`AI stack: **${usd(c.aiPerMinute)}/min** (before telephony)`);
  p();
  p("| Line item | USD | PKR |");
  p("|---|---:|---:|");
  for (const [k, v] of Object.entries(c.lines)) p(`| ${k} | ${usd(v)} | ${pkr(v)} |`);
  for (const [k, v] of Object.entries(c.option.campaignMonthFixed)) p(`| ${k} | ${usd(v)} | ${pkr(v)} |`);
  p(`| **Campaign total** | **${usd(c.total)}** | **${pkr(c.total)}** |`);
  p();
}

p("## Summary");
p();
p("| Option | Per campaign (USD) | Per campaign (PKR) | Per student | Idle month (USD) |");
p("|---|---:|---:|---:|---:|");
for (const c of costs) {
  p(`| ${c.option.id} — ${c.option.name} | ${usd(c.total)} | ${pkr(c.total)} | ${usd(c.perStudent)} | ${usd(c.idleMonth)} |`);
}
p();

p("## Sensitivity: in-call LLM choice (Option B)");
p();
p("| In-call LLM | Campaign total (USD) | PKR |");
p("|---|---:|---:|");
for (const m of Object.keys(prices.llmPerMTok) as LlmModel[]) {
  const c = campaignCost({ ...options[1]!, llmModel: m });
  p(`| ${m} | ${usd(c.total)} | ${pkr(c.total)} |`);
}
p();
p("## Sensitivity: classifier model (Option B)");
p();
p("| Classifier | Campaign total (USD) | PKR |");
p("|---|---:|---:|");
for (const m of Object.keys(prices.llmPerMTok) as LlmModel[]) {
  const c = campaignCost({ ...options[1]!, classifierModel: m });
  p(`| ${m} | ${usd(c.total)} | ${pkr(c.total)} |`);
}
p();
p("## Sensitivity: local SIP rate (Option B)");
p();
p("| PK rate / min | Campaign total (USD) | PKR |");
p("|---|---:|---:|");
for (const r of [0.006, 0.012, 0.02, 0.03]) {
  const c = campaignCost({ ...options[1]!, pkPerMinute: r });
  p(`| ${usd(r)} (PKR ${(r * USD_TO_PKR).toFixed(1)}) | ${usd(c.total)} | ${pkr(c.total)} |`);
}

console.log(out.join("\n"));
