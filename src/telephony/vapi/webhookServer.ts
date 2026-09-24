import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { CallStore } from "../../store/callStore.ts";
import { RECORD_OUTCOME_TOOL_NAME } from "./payloads.ts";
import { guessLanguageFromScript, parseAgentReportArgs, parseEndOfCallReport, type EndOfCallReport } from "./report.ts";

export interface WebhookServerOptions {
  store: CallStore;
  /** Shared secret configured as a Vapi bearer-token credential. Required. */
  bearerToken: string;
  path?: string;
  maxBodyBytes?: number;
  log?: (msg: string) => void;
}

const MAX_BODY = 5 * 1024 * 1024;

function tokenMatches(header: string | undefined, token: string): boolean {
  const got = Buffer.from((header ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw Object.assign(new Error("payload too large"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

interface ToolCall {
  id?: string;
  name?: string;
  parameters?: unknown;
  function?: { name?: string; arguments?: unknown };
}

/**
 * Receives Vapi server messages:
 *  - tool-calls          → stores the agent's record_outcome, replies with results
 *  - end-of-call-report  → stores the call result (idempotent)
 *  - anything else       → acknowledged
 */
export function createWebhookServer(opts: WebhookServerOptions): Server {
  if (!opts.bearerToken || opts.bearerToken.length < 16) throw new Error("Webhook bearer token must be set and at least 16 characters");
  const path = opts.path ?? "/vapi/webhook";
  const log = opts.log ?? (() => {});

  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
      if (req.method !== "POST" || req.url?.split("?")[0] !== path) return send(res, 404, { error: "not found" });
      if (!tokenMatches(req.headers.authorization, opts.bearerToken)) return send(res, 401, { error: "unauthorized" });

      const body = JSON.parse(await readBody(req, opts.maxBodyBytes ?? MAX_BODY)) as { message?: { type?: string; call?: { id?: string } } };
      const message = body.message;
      const callId = message?.call?.id;
      if (!message?.type) return send(res, 400, { error: "missing message.type" });

      if (message.type === "tool-calls") {
        const m = message as { toolCallList?: ToolCall[]; toolCalls?: ToolCall[] };
        const calls = m.toolCallList ?? m.toolCalls ?? [];
        const results = calls.map((tc) => {
          const name = tc.name ?? tc.function?.name;
          if (name !== RECORD_OUTCOME_TOOL_NAME) return { toolCallId: tc.id, result: "Unknown tool." };
          const report = parseAgentReportArgs(tc.parameters ?? tc.function?.arguments);
          if (!report) return { toolCallId: tc.id, result: "Invalid outcome. Use one of the allowed values." };
          if (callId) opts.store.setAgentReport(callId, report);
          log(`call ${callId}: agent recorded ${report.outcome}`);
          return { toolCallId: tc.id, result: "Recorded. Now say goodbye and end the call." };
        });
        return send(res, 200, { results });
      }

      if (message.type === "end-of-call-report") {
        const result = parseEndOfCallReport(message as EndOfCallReport);
        const studentText = result.transcript.filter((t) => t.role === "student").map((t) => t.text).join(" ");
        const lang = guessLanguageFromScript(studentText);
        if (lang) result.detectedLanguage = lang;
        const fresh = opts.store.saveResult(result.providerCallId, result);
        log(`call ${result.providerCallId}: ${result.endReason} ${result.durationSec}s${fresh ? "" : " (duplicate ignored)"}`);
        return send(res, 200, {});
      }

      return send(res, 200, {});
    } catch (e) {
      const status = (e as { status?: number }).status ?? (e instanceof SyntaxError ? 400 : 500);
      log(`webhook error ${status}: ${(e as Error).message}`);
      return send(res, status, { error: status === 500 ? "internal error" : (e as Error).message });
    }
  });
}
