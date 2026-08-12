import { describe, expect, it } from "vitest";

import { buildTrend, percent, toCsv } from "@/lib/analytics/analytics";

describe("buildTrend", () => {
  const now = new Date(2026, 7, 12, 15, 0, 0); // Aug 12, 2026 3pm local

  function at(month: number, day: number, hour = 9): Date {
    return new Date(2026, month, day, hour, 0, 0);
  }

  it("returns days consecutive zero-filled points ending today", () => {
    const trend = buildTrend([], [], 14, now);
    expect(trend).toHaveLength(14);
    expect(trend[13].iso).toBe("2026-08-12");
    expect(trend[13].label).toBe("Aug 12");
    expect(trend[0].iso).toBe("2026-07-30");
    expect(trend.every((p) => p.sent === 0 && p.replied === 0)).toBe(true);
  });

  it("buckets sends and replies into their local day", () => {
    const trend = buildTrend(
      [at(7, 10, 9), at(7, 10, 18), at(7, 11, 8)], // Aug 10 ×2, Aug 11 ×1
      [at(7, 10, 12)],
      14,
      now,
    );
    const aug10 = trend.find((p) => p.iso === "2026-08-10");
    const aug11 = trend.find((p) => p.iso === "2026-08-11");
    expect(aug10?.sent).toBe(2);
    expect(aug10?.replied).toBe(1);
    expect(aug11?.sent).toBe(1);
    expect(aug11?.replied).toBe(0);
  });

  it("ignores timestamps before the window", () => {
    const trend = buildTrend([at(6, 1)], [], 7, now);
    expect(trend.reduce((sum, p) => sum + p.sent, 0)).toBe(0);
  });

  it("handles midnight UTC vs local time without losing a day", () => {
    // Aug 12 00:30 local on Aug 11 19:00 UTC — must still land on Aug 12.
    const lateNight = new Date(2026, 7, 12, 0, 30, 0);
    const trend = buildTrend([lateNight], [], 3, now);
    expect(trend.find((p) => p.iso === "2026-08-12")?.sent).toBe(1);
  });
});

describe("percent", () => {
  it("formats ratios as whole percents by default", () => {
    expect(percent(0.123)).toBe("12%");
    expect(percent(1)).toBe("100%");
  });
  it("supports decimals", () => {
    expect(percent(0.127, 1)).toBe("12.7%");
  });
});

describe("toCsv", () => {
  it("writes a header row and one line per row", () => {
    const csv = toCsv([
      { campaign: "Q3 launch", sent: 42, replied: 7 },
      { campaign: "Q4 push", sent: 10, replied: 0 },
    ]);
    expect(csv.split("\n")).toEqual([
      "campaign,sent,replied",
      "Q3 launch,42,7",
      "Q4 push,10,0",
    ]);
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv([{ note: 'say "hi", ok\nbye' }]);
    expect(csv).toContain('"say ""hi"", ok\nbye"');
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
