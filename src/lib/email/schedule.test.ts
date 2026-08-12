import { describe, it, expect } from "vitest";

import {
  computeSendTimes,
  isWithinWorkingHours,
  nextWindowStart,
  delayUntil,
  startOfDayInTimezone,
} from "./schedule";

const UTC = "UTC";

describe("isWithinWorkingHours", () => {
  const settings = { timezone: UTC, workingHoursStart: "09:00", workingHoursEnd: "18:00" };

  it("is true inside the window", () => {
    expect(isWithinWorkingHours(new Date("2026-01-05T10:30:00Z"), settings)).toBe(true);
  });

  it("is false before the window", () => {
    expect(isWithinWorkingHours(new Date("2026-01-05T08:00:00Z"), settings)).toBe(false);
  });

  it("is false at/after the exclusive end", () => {
    expect(isWithinWorkingHours(new Date("2026-01-05T18:00:00Z"), settings)).toBe(false);
    expect(isWithinWorkingHours(new Date("2026-01-05T22:00:00Z"), settings)).toBe(false);
  });
});

describe("nextWindowStart", () => {
  it("returns today's start when already before it", () => {
    const settings = { timezone: UTC, workingHoursStart: "09:00" };
    const result = nextWindowStart(new Date("2026-01-05T07:00:00Z"), settings);
    expect(result.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });

  it("returns the next day when already inside/after today's window", () => {
    const settings = { timezone: UTC, workingHoursStart: "09:00" };
    expect(nextWindowStart(new Date("2026-01-05T12:00:00Z"), settings).toISOString()).toBe(
      "2026-01-06T09:00:00.000Z",
    );
  });
});

describe("computeSendTimes", () => {
  const fixedRandom = () => 0.5;
  const baseSettings = {
    timezone: UTC,
    workingHoursStart: "09:00",
    workingHoursEnd: "18:00",
    sendDelayMin: 60,
    sendDelayMax: 60, // fixed delay: exactly 60s apart
    dailySendLimit: 10,
  };

  it("spaces consecutive sends by the delay window", () => {
    const now = new Date("2026-01-05T09:00:00Z");
    const times = computeSendTimes({ count: 4, settings: baseSettings, now, random: fixedRandom });
    expect(times.map((t) => t.getTime())).toEqual([
      now.getTime(),
      now.getTime() + 60_000,
      now.getTime() + 120_000,
      now.getTime() + 180_000,
    ]);
  });

  it("rolls over to the next working day once the daily limit is hit", () => {
    const now = new Date("2026-01-05T09:00:00Z");
    const times = computeSendTimes({
      count: 12, // > limit of 10
      settings: baseSettings,
      now,
      random: fixedRandom,
    });
    expect(times.length).toBe(12);
    expect(times[0].toISOString()).toBe("2026-01-05T09:00:00.000Z");
    expect(times[9].toISOString()).toBe("2026-01-05T09:09:00.000Z");
    expect(times[10].toISOString()).toBe("2026-01-06T09:00:00.000Z");
    expect(times[11].toISOString()).toBe("2026-01-06T09:01:00.000Z");
  });

  it("accounts for sends already made today against the daily cap", () => {
    const now = new Date("2026-01-05T09:00:00Z");
    const times = computeSendTimes({
      count: 2,
      settings: baseSettings,
      now,
      sentToday: 9, // 9 already sent → only 1 more today
      random: fixedRandom,
    });
    expect(times[0].toISOString()).toBe("2026-01-05T09:00:00.000Z");
    expect(times[1].toISOString()).toBe("2026-01-06T09:00:00.000Z");
  });

  it("holds until the window opens when scheduling before working hours", () => {
    const now = new Date("2026-01-05T06:30:00Z");
    const times = computeSendTimes({ count: 1, settings: baseSettings, now, random: fixedRandom });
    expect(times[0].toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });
});

describe("delayUntil", () => {
  it("is >= 0 even when the target is in the past", () => {
    expect(delayUntil(new Date("2020-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))).toBe(0);
  });

  it("returns the positive difference in the future", () => {
    expect(delayUntil(new Date("2026-01-05T10:00:00Z"), new Date("2026-01-05T09:00:00Z"))).toBe(
      3_600_000,
    );
  });
});

describe("startOfDayInTimezone", () => {
  it("returns 00:00 UTC for the UTC zone", () => {
    expect(startOfDayInTimezone(new Date("2026-01-05T15:00:00Z"), "UTC").toISOString()).toBe(
      "2026-01-05T00:00:00.000Z",
    );
  });

  it("shifts for a non-UTC timezone (America/New_York, winter = -5)", () => {
    expect(
      startOfDayInTimezone(new Date("2026-01-05T15:00:00Z"), "America/New_York").toISOString(),
    ).toBe("2026-01-05T05:00:00.000Z");
  });
});