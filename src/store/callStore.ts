import { EventEmitter } from "node:events";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentReport, CallResult } from "../types.ts";

/**
 * Durable record of placed calls and their results, keyed by provider call ID.
 * Phase 1: in-memory map + append-only JSONL file (survives restarts, easy to inspect).
 * Phase 3 replaces this with Postgres behind the same methods.
 *
 * Idempotent by design: webhooks can be delivered twice; the first result wins.
 */
type Event =
  | { t: "placed"; callId: string; attemptKey: string; applicantId: string; at: string }
  | { t: "agentReport"; callId: string; report: AgentReport; at: string }
  | { t: "result"; callId: string; result: CallResult; at: string };

export interface StoredCall {
  callId: string;
  attemptKey?: string;
  applicantId?: string;
  agentReport?: AgentReport;
  result?: CallResult;
}

export class CallStore {
  private calls = new Map<string, StoredCall>();
  private events = new EventEmitter();

  constructor(private readonly file?: string) {
    if (file && existsSync(file)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (line.trim()) this.apply(JSON.parse(line, reviveDates) as Event);
      }
    }
    if (file) mkdirSync(dirname(file), { recursive: true });
    this.events.setMaxListeners(0);
  }

  private get(callId: string): StoredCall {
    let c = this.calls.get(callId);
    if (!c) {
      c = { callId };
      this.calls.set(callId, c);
    }
    return c;
  }

  /** Applies an event; returns false if it was a duplicate result. */
  private apply(e: Event): boolean {
    const c = this.get(e.callId);
    if (e.t === "placed") {
      c.attemptKey = e.attemptKey;
      c.applicantId = e.applicantId;
    } else if (e.t === "agentReport") {
      c.agentReport ??= e.report;
    } else {
      if (c.result) return false;
      c.result = { ...e.result, agentReport: e.result.agentReport ?? c.agentReport };
    }
    return true;
  }

  private record(e: Event): boolean {
    const applied = this.apply(e);
    if (applied && this.file) appendFileSync(this.file, JSON.stringify(e) + "\n");
    return applied;
  }

  registerCall(callId: string, attemptKey: string, applicantId: string): void {
    this.record({ t: "placed", callId, attemptKey, applicantId, at: new Date().toISOString() });
  }

  /** From the agent's record_outcome tool call during the call. First report wins. */
  setAgentReport(callId: string, report: AgentReport): void {
    if (this.calls.get(callId)?.agentReport) return;
    this.record({ t: "agentReport", callId, report, at: new Date().toISOString() });
    const c = this.calls.get(callId)!;
    if (c.result && !c.result.agentReport) c.result.agentReport = report;
  }

  /** From the end-of-call report. Returns false for a duplicate delivery. */
  saveResult(callId: string, result: CallResult): boolean {
    const applied = this.record({ t: "result", callId, result, at: new Date().toISOString() });
    if (applied) this.events.emit(`result:${callId}`, this.calls.get(callId)!.result);
    return applied;
  }

  find(callId: string): StoredCall | undefined {
    return this.calls.get(callId);
  }

  all(): StoredCall[] {
    return [...this.calls.values()];
  }

  waitForResult(callId: string, timeoutMs: number): Promise<CallResult> {
    const existing = this.calls.get(callId)?.result;
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.events.off(`result:${callId}`, onResult);
        reject(new Error(`No result for call ${callId} within ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
      const onResult = (r: CallResult) => {
        clearTimeout(timer);
        resolve(r);
      };
      this.events.once(`result:${callId}`, onResult);
    });
  }
}

function reviveDates(key: string, value: unknown): unknown {
  return (key === "startedAt" || key === "endedAt") && typeof value === "string" ? new Date(value) : value;
}
