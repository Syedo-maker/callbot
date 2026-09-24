import { describe, expect, it } from "vitest";
import { campaignCost, computeVolume, linesNeeded, options } from "../src/cost/costModel.ts";

describe("cost model", () => {
  it("computes the documented volume for 10,000 students", () => {
    const v = computeVolume();
    expect(v.attempts).toBe(14_500);
    expect(v.connected).toBe(9_250);
    expect(v.neverReached).toBe(750);
    expect(Math.round(v.telephonyMinutes60)).toBe(19_550);
  });

  it("matches the totals quoted in docs/01-cost-estimate.md", () => {
    const [a, b, c] = options.map((o) => Math.round(campaignCost(o).total));
    expect(a).toBe(5_176);
    expect(b).toBe(2_280);
    expect(c).toBe(1_748);
  });

  it("sizes concurrency", () => {
    expect(linesNeeded(80)).toBe(4);
    expect(linesNeeded(24)).toBe(13);
  });
});
