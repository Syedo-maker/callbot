import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCampaignConfig, loadPersonas } from "../src/config.ts";
import { CallStore } from "../src/store/callStore.ts";
import { MockVoiceProvider, scenarioForPhone } from "../src/telephony/mockProvider.ts";
import { prepareCallRequest } from "../src/telephony/prepareCall.ts";
import type { CallResult } from "../src/types.ts";

const result = (id: string, over: Partial<CallResult> = {}): CallResult => ({
  providerCallId: id,
  startedAt: new Date("2026-09-24T10:00:00Z"),
  endedAt: new Date("2026-09-24T10:01:00Z"),
  durationSec: 60,
  endReason: "completed",
  transcript: [],
  ...over,
});

describe("CallStore", () => {
  it("persists to JSONL and reloads after restart", () => {
    const file = join(mkdtempSync(join(tmpdir(), "callbot-")), "calls.jsonl");
    const s1 = new CallStore(file);
    s1.registerCall("c1", "camp:a1:1", "a1");
    s1.setAgentReport("c1", { outcome: "confirmed" });
    s1.saveResult("c1", result("c1"));
    const s2 = new CallStore(file);
    const c = s2.find("c1")!;
    expect(c.attemptKey).toBe("camp:a1:1");
    expect(c.result?.agentReport).toEqual({ outcome: "confirmed" });
    expect(c.result?.startedAt).toBeInstanceOf(Date);
  });

  it("keeps the first result and first agent report", () => {
    const s = new CallStore();
    expect(s.saveResult("c1", result("c1", { durationSec: 10 }))).toBe(true);
    expect(s.saveResult("c1", result("c1", { durationSec: 99 }))).toBe(false);
    s.setAgentReport("c1", { outcome: "declined" });
    s.setAgentReport("c1", { outcome: "confirmed" });
    expect(s.find("c1")!.result!.durationSec).toBe(10);
    expect(s.find("c1")!.agentReport).toEqual({ outcome: "declined" });
    expect(s.find("c1")!.result!.agentReport).toEqual({ outcome: "declined" });
  });

  it("times out when no result arrives", async () => {
    await expect(new CallStore().waitForResult("nope", 20)).rejects.toThrow(/No result/);
  });
});

describe("MockVoiceProvider", () => {
  it("delivers a result asynchronously through the store", async () => {
    const store = new CallStore();
    const provider = new MockVoiceProvider(store, () => "declined");
    const req = prepareCallRequest(
      { id: "a1", name: "Ayesha", gender: "female", phone: "+923001234567", country: "PK", program: "BBA", extra: {} },
      "camp:a1:1",
      loadCampaignConfig(),
      loadPersonas(),
    );
    const { providerCallId } = await provider.placeCall(req);
    const r = await store.waitForResult(providerCallId, 1000);
    expect(r.endReason).toBe("completed");
    expect(r.transcript[0]!.text).toBe(req.openingLine);
    expect(store.find(providerCallId)!.agentReport?.outcome).toBe("declined");
  });

  it("gives stable scenarios per phone and attempt", () => {
    expect(scenarioForPhone("+923001234567", 1)).toBe(scenarioForPhone("+923001234567", 1));
  });
});
