/**
 * Campaign cost model. Every number in docs/01-cost-estimate.md is produced by
 * `npm run cost`, which runs this model — change an assumption here, re-run, and
 * paste the new tables into the doc.
 *
 * Prices are USD, verified September 2026 (sources listed in the cost doc).
 * Rates marked ESTIMATE have no public rate card and must be replaced by quotes.
 */

export const USD_TO_PKR = 277; // Sept 2026 average (range 273–281)

export interface VolumeAssumptions {
  students: number;
  /** Share of students who answer on the first attempt. 0.70 = "30% need retries". */
  firstAttemptAnswerRate: number;
  /** Share of the remaining students reached on each retry round. */
  retryAnswerRate: number;
  /** Retry rounds after the first attempt (maxAttempts - 1). */
  retryRounds: number;
  avgTalkMinutes: number;
  /** Unanswered attempts that still connect to voicemail / network message and get billed. */
  unansweredBilledShare: number;
  /** AI minutes spent on an unanswered-but-billed attempt (voicemail detection then hang up). */
  unansweredAiMinutes: number;
  /** Share of numbers outside Pakistan. */
  internationalShare: number;
}

export const defaultVolume: VolumeAssumptions = {
  students: 10_000,
  firstAttemptAnswerRate: 0.7,
  retryAnswerRate: 0.5,
  retryRounds: 2,
  avgTalkMinutes: 1.5,
  unansweredBilledShare: 0.2,
  unansweredAiMinutes: 0.25,
  internationalShare: 0.1,
};

export interface Volume {
  attempts: number;
  connected: number;
  neverReached: number;
  unansweredAttempts: number;
  /** Minutes the AI stack is running (billed per second on managed platforms). */
  aiMinutes: number;
  /** Minutes the carrier bills when it rounds every call up to a whole minute (60/60). */
  telephonyMinutes60: number;
  /** Minutes the carrier bills with per-second billing. */
  telephonyMinutesPerSecond: number;
}

export function computeVolume(v: VolumeAssumptions = defaultVolume): Volume {
  let remaining = v.students;
  let attempts = 0;
  let connected = 0;

  const first = v.students * v.firstAttemptAnswerRate;
  attempts += v.students;
  connected += first;
  remaining -= first;

  for (let round = 0; round < v.retryRounds; round++) {
    attempts += remaining;
    const reached = remaining * v.retryAnswerRate;
    connected += reached;
    remaining -= reached;
  }

  const unansweredAttempts = attempts - connected;
  const billedUnanswered = unansweredAttempts * v.unansweredBilledShare;

  return {
    attempts: Math.round(attempts),
    connected: Math.round(connected),
    neverReached: Math.round(remaining),
    unansweredAttempts: Math.round(unansweredAttempts),
    aiMinutes: connected * v.avgTalkMinutes + billedUnanswered * v.unansweredAiMinutes,
    telephonyMinutes60: connected * Math.ceil(v.avgTalkMinutes) + billedUnanswered * 1,
    telephonyMinutesPerSecond: connected * v.avgTalkMinutes + billedUnanswered * 0.5,
  };
}

/** Per-minute component prices (USD). */
export const prices = {
  // Speech-to-text, streaming
  sttElevenLabsScribeRealtime: 0.39 / 60, // $0.39 / audio hour
  sttDeepgramNova3Multilingual: 0.0058,

  // Text-to-speech. The agent speaks ~50% of the call ≈ 450 characters per call-minute.
  ttsCharsPerCallMinute: 450,
  ttsElevenLabsFlashPer1kChars: 0.05,
  ttsAzureNeuralPer1MChars: 16,

  // In-call LLM, per call-minute. ~8 turns in a 1.5-min call, ~2.1k input tokens/turn
  // (1.5k system prompt + growing history), ~60 output tokens/turn, no caching assumed.
  llmTokensPerCall: { input: 8 * 2_100, output: 8 * 60 },
  llmPerMTok: {
    "claude-haiku-4-5": { input: 1, output: 5 },
    "claude-sonnet-5": { input: 2, output: 10 },
    "claude-opus-5": { input: 5, output: 25 },
  },

  // Post-call classification + summary, per connected call (transcript ~2.5k tokens in, ~500 out incl. thinking)
  classifierTokensPerCall: { input: 2_500, output: 500 },

  // Voice-agent platform fee
  platformVapi: 0.05,
  platformRetell: 0.07,

  // Telephony, per billed minute
  twilioPakistanMobile: 0.18,
  twilioPakistanLandline: 0.155,
  /** Blend of Twilio mobile rates: Saudi 0.225, UAE 0.2205, Qatar 0.30, UK 0.029, Kuwait 0.13. */
  internationalBlended: 0.22,
  /** ESTIMATE — licensed Pakistani operator (PTCL/Nayatel/Wateen/Multinet/Jazz business) SIP or PRI, ~PKR 3.3/min. Get quotes. */
  localPkSipPerMinute: 0.012,
} as const;

export type LlmModel = keyof typeof prices.llmPerMTok;

export function llmCostPerCall(model: LlmModel, tokens = prices.llmTokensPerCall): number {
  const p = prices.llmPerMTok[model];
  return (tokens.input * p.input + tokens.output * p.output) / 1_000_000;
}

export function llmCostPerMinute(model: LlmModel, avgTalkMinutes = defaultVolume.avgTalkMinutes): number {
  return llmCostPerCall(model) / avgTalkMinutes;
}

export function ttsElevenLabsPerMinute(): number {
  return (prices.ttsCharsPerCallMinute / 1000) * prices.ttsElevenLabsFlashPer1kChars;
}

export function ttsAzurePerMinute(): number {
  return (prices.ttsCharsPerCallMinute / 1_000_000) * prices.ttsAzureNeuralPer1MChars;
}

export interface ArchitectureOption {
  id: string;
  name: string;
  platformPerMinute: number;
  sttPerMinute: number;
  ttsPerMinute: number;
  llmModel: LlmModel;
  /** true when the carrier bills per second, false when it rounds up to whole minutes. */
  perSecondTelephony: boolean;
  pkPerMinute: number;
  intlPerMinute: number;
  classifierModel: LlmModel;
  /** Fixed costs for the month the campaign runs (USD). */
  campaignMonthFixed: Record<string, number>;
  /** Fixed costs for an idle month with no campaign (USD). */
  idleMonthFixed: Record<string, number>;
}

export const options: ArchitectureOption[] = [
  {
    id: "A",
    name: "Managed platform (Vapi) + Twilio",
    platformPerMinute: prices.platformVapi,
    sttPerMinute: prices.sttElevenLabsScribeRealtime,
    ttsPerMinute: ttsElevenLabsPerMinute(),
    llmModel: "claude-haiku-4-5",
    perSecondTelephony: false,
    pkPerMinute: prices.twilioPakistanMobile,
    intlPerMinute: prices.internationalBlended,
    classifierModel: "claude-opus-5",
    campaignMonthFixed: {
      "Extra concurrency (not needed: 10 included lines finish in ~4 days)": 0,
      "App hosting + Postgres (dashboard, webhooks)": 40,
      "Twilio caller-ID number": 5,
    },
    idleMonthFixed: {
      "App hosting + Postgres": 40,
      "Twilio number": 5,
    },
  },
  {
    id: "B",
    name: "Managed platform (Vapi) + local Pakistani SIP trunk (recommended)",
    platformPerMinute: prices.platformVapi,
    sttPerMinute: prices.sttElevenLabsScribeRealtime,
    ttsPerMinute: ttsElevenLabsPerMinute(),
    llmModel: "claude-haiku-4-5",
    perSecondTelephony: false,
    pkPerMinute: prices.localPkSipPerMinute,
    intlPerMinute: prices.internationalBlended,
    classifierModel: "claude-opus-5",
    campaignMonthFixed: {
      "Extra concurrency (not needed: 10 included lines finish in ~4 days)": 0,
      "App hosting + Postgres (dashboard, webhooks)": 40,
      "SBC / SIP gateway VM (Asterisk or FreeSWITCH)": 20,
      "Local SIP trunk / UAN rental (ESTIMATE)": 40,
      "Twilio number for international leg": 5,
    },
    idleMonthFixed: {
      "App hosting + Postgres": 40,
      "SBC VM (can be stopped off-season)": 0,
      "Local SIP trunk rental (ESTIMATE)": 40,
      "Twilio number": 5,
    },
  },
  {
    id: "C",
    name: "Fully custom (LiveKit Agents / Pipecat, self-hosted) + local SIP trunk",
    platformPerMinute: 0,
    sttPerMinute: prices.sttElevenLabsScribeRealtime,
    ttsPerMinute: ttsElevenLabsPerMinute(),
    llmModel: "claude-haiku-4-5",
    perSecondTelephony: false,
    pkPerMinute: prices.localPkSipPerMinute,
    intlPerMinute: prices.internationalBlended,
    classifierModel: "claude-opus-5",
    campaignMonthFixed: {
      "Agent worker VMs (2 × 8 vCPU, 20 concurrent sessions)": 150,
      "App hosting + Postgres + Redis": 50,
      "SBC / SIP gateway VM": 20,
      "Local SIP trunk / UAN rental (ESTIMATE)": 40,
      "Monitoring / logs": 20,
    },
    idleMonthFixed: {
      "App hosting + Postgres (workers stopped)": 50,
      "Local SIP trunk rental (ESTIMATE)": 40,
    },
  },
];

export interface CampaignCost {
  option: ArchitectureOption;
  aiPerMinute: number;
  lines: Record<string, number>;
  variableTotal: number;
  fixedTotal: number;
  total: number;
  perStudent: number;
  perConnectedCall: number;
  idleMonth: number;
}

export function campaignCost(
  option: ArchitectureOption,
  v: VolumeAssumptions = defaultVolume,
): CampaignCost {
  const vol = computeVolume(v);
  const aiPerMinute =
    option.platformPerMinute + option.sttPerMinute + option.ttsPerMinute + llmCostPerMinute(option.llmModel, v.avgTalkMinutes);
  const telMinutes = option.perSecondTelephony ? vol.telephonyMinutesPerSecond : vol.telephonyMinutes60;
  const pkMinutes = telMinutes * (1 - v.internationalShare);
  const intlMinutes = telMinutes * v.internationalShare;

  const classifierPerCall = llmCostPerCall(option.classifierModel, prices.classifierTokensPerCall);

  const lines: Record<string, number> = {
    "Voice-agent platform fee": vol.aiMinutes * option.platformPerMinute,
    "Speech-to-text": vol.aiMinutes * option.sttPerMinute,
    "Text-to-speech": vol.aiMinutes * option.ttsPerMinute,
    [`In-call LLM (${option.llmModel})`]: vol.aiMinutes * llmCostPerMinute(option.llmModel, v.avgTalkMinutes),
    "Telephony — Pakistan": pkMinutes * option.pkPerMinute,
    "Telephony — international": intlMinutes * option.intlPerMinute,
    [`Post-call classifier (${option.classifierModel})`]: vol.connected * classifierPerCall,
    "Recording + transcript storage": 5,
  };
  const variableTotal = Object.values(lines).reduce((a, b) => a + b, 0);
  const fixedTotal = Object.values(option.campaignMonthFixed).reduce((a, b) => a + b, 0);
  const total = variableTotal + fixedTotal;

  return {
    option,
    aiPerMinute,
    lines,
    variableTotal,
    fixedTotal,
    total,
    perStudent: total / v.students,
    perConnectedCall: total / vol.connected,
    idleMonth: Object.values(option.idleMonthFixed).reduce((a, b) => a + b, 0),
  };
}

/**
 * Concurrent lines needed to finish all attempts within `callingHours`.
 * Ringing time on unanswered attempts is counted because the line is busy.
 */
export function linesNeeded(callingHours: number, v: VolumeAssumptions = defaultVolume, ringMinutes = 0.6): number {
  const vol = computeVolume(v);
  const lineMinutes = vol.connected * (v.avgTalkMinutes + 0.1) + vol.unansweredAttempts * ringMinutes;
  return Math.ceil(lineMinutes / (callingHours * 60));
}

export function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 3 : 0, minimumFractionDigits: 0 })}`;
}

export function pkr(n: number): string {
  return `PKR ${Math.round(n * USD_TO_PKR).toLocaleString("en-US")}`;
}
