export type Gender = "female" | "male" | "unknown";

/** ISO 639-1 where one exists; `skr` Saraiki, `bal` Balochi, `hno` Hindko use ISO 639-3. */
export type LanguageCode = "ur" | "en" | "pa" | "ps" | "sd" | "ar" | "hi" | "skr" | "bal" | "hno";

export interface Applicant {
  id: string;
  name: string;
  gender: Gender;
  /** E.164, e.g. +923001234567 */
  phone: string;
  /** ISO 3166 alpha-2 of the phone number, e.g. PK */
  country: string;
  program: string;
  preferredLanguage?: LanguageCode;
  /** Source columns we did not map, passed through to result files. */
  extra: Record<string, string>;
}

/** How the call ended at the telephony / platform level. */
export type EndReason =
  | "completed" // a conversation happened and ended normally
  | "no_answer"
  | "busy"
  | "failed" // network / invalid number / carrier rejection
  | "voicemail"
  | "dropped" // connected but cut off before an outcome
  | "time_limit";

/** What the agent (or classifier) concluded from the conversation. */
export type ConversationOutcome =
  | "confirmed"
  | "declined"
  | "undecided"
  | "callback_requested"
  | "wrong_person"
  | "wrong_number"
  | "human_requested"
  | "opted_out"
  | "off_topic_limit"
  | "complaint"
  | "language_unsupported"
  | "no_conversation";

/** Final dataset a student lands in. */
export type FinalOutcome = "confirmed" | "declined" | "no_answer" | "escalation";

export type SubOutcome =
  | ConversationOutcome
  | Exclude<EndReason, "completed">
  | "classifier_disagreement"
  | "low_confidence";

export interface TranscriptTurn {
  role: "agent" | "student";
  text: string;
  /** Seconds from call start. */
  at?: number;
}

export interface AgentReport {
  outcome: ConversationOutcome;
  reason?: string;
}

/** What a voice provider returns for one call attempt. */
export interface CallResult {
  providerCallId: string;
  startedAt: Date;
  endedAt: Date;
  /** Connected talk time in seconds (0 if never answered). */
  durationSec: number;
  endReason: EndReason;
  /** Language the student mainly spoke, if the platform detected it. */
  detectedLanguage?: LanguageCode;
  transcript: TranscriptTurn[];
  /** Outcome the in-call agent recorded via its record_outcome tool. */
  agentReport?: AgentReport;
  recordingUrl?: string;
}

export interface Classification {
  outcome: ConversationOutcome;
  reason?: string;
  summary: string;
  languageUsed?: string;
  needsHuman: boolean;
  confidence: number;
}

export interface AttemptRecord {
  applicantId: string;
  attempt: number;
  persona: string;
  openingLanguage: LanguageCode;
  result: CallResult;
  classification?: Classification;
}

export interface ResultRecord {
  applicant: Applicant;
  outcome: FinalOutcome;
  subOutcome: SubOutcome;
  reason?: string;
  summary: string;
  languageUsed?: string;
  attempts: number;
  lastCallAt?: Date;
  lastCallDurationSec: number;
  totalTalkSec: number;
  needsHuman: boolean;
  persona: string;
  recordingUrl?: string;
  transcriptFile?: string;
}
