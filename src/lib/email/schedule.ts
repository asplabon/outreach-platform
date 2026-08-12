import { env } from "@/lib/env";

/**
 * Send pacing.
 *
 * Given a campaign's sending settings we compute, for each lead, the exact
 * send time: spaced by the configured delay window, only inside the working
 * hours window, capped at `dailySendLimit` per day, all in the campaign's
 * timezone. Pure and deterministic (optional `now`/`random` for tests).
 */

export interface SendSettings {
  /** IANA timezone, e.g. "UTC", "America/New_York". */
  timezone: string;
  /** HH:MM (24h) inclusive start of the working window. */
  workingHoursStart: string;
  /** HH:MM (24h) exclusive end of the working window. */
  workingHoursEnd: string;
  /** Seconds between consecutive sends (lower bound). */
  sendDelayMin: number;
  /** Seconds between consecutive sends (upper bound). */
  sendDelayMax: number;
  /** Max sends per day for this mailbox. */
  dailySendLimit: number;
}

export interface SendTimesInput {
  count: number;
  settings: SendSettings;
  /** When scheduling begins. Defaults to now. */
  now?: Date;
  /** Number already sent today for this mailbox. Defaults to 0. */
  sentToday?: number;
  /** Random source in [0,1) for the delay window. Defaults to Math.random. */
  random?: () => number;
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHHMM(value: string): { h: number; m: number } {
  const match = HHMM_RE.exec(value);
  if (!match) throw new Error(`Invalid HH:MM value "${value}"`);
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** "HH:MM" of the given instant in the given timezone, 24h clock. */
export function hhmmInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/** Difference between UTC and the timezone's wall clock, in minutes. */
function tzOffsetMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );
  // Wall clock ahead of UTC → positive offset.
  return (asUtc - date.getTime()) / 60_000;
}

/**
 * Convert wall-clock components (as they read on a clock in `timezone`) to a
 * Date instant. Converges across DST by re-anchoring the offset a few times.
 */
function zonedToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timezone: string,
): Date {
  let est = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  for (let i = 0; i < 3; i += 1) {
    const offset = tzOffsetMinutes(new Date(est), timezone);
    est = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - offset * 60_000;
  }
  return new Date(est);
}

/** Plain year/month/day/hour/minute that `date` reads as in `timezone`. */
function zonedParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
  };
}

/** True when `date` falls inside the campaign's working window (in tz). */
export function isWithinWorkingHours(
  date: Date,
  settings: Pick<SendSettings, "timezone" | "workingHoursStart" | "workingHoursEnd">,
): boolean {
  const start = parseHHMM(settings.workingHoursStart);
  const end = parseHHMM(settings.workingHoursEnd);
  const { h, m } = parseHHMM(hhmmInTimezone(date, settings.timezone));
  const nowMin = h * 60 + m;
  return start.h * 60 + start.m <= nowMin && nowMin < end.h * 60 + end.m;
}

/**
 * The instant of the next opening of the working window at or after `date`.
 * If `date` is before today's start, that's today's start; otherwise the next
 * day that still has room (daily limit is checked by the caller).
 */
export function nextWindowStart(
  date: Date,
  settings: Pick<SendSettings, "timezone" | "workingHoursStart">,
): Date {
  const { h, m } = parseHHMM(settings.workingHoursStart);
  let candidate = zonedToUtc(
    { ...zonedParts(date, settings.timezone), hour: h, minute: m },
    settings.timezone,
  );
  while (candidate.getTime() <= date.getTime()) {
    candidate = new Date(candidate.getTime() + 86_400_000);
  }
  return candidate;
}

/** Date-only key (in tz) so the daily counter can reset at midnight. */
function zonedDayKey(date: Date, timezone: string): string {
  const p = zonedParts(date, timezone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function randBetween(min: number, max: number, random: () => number): number {
  if (max <= min) return min;
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * Compute an ordered send timestamp for `count` leads.
 *
 * Guarantees:
 * - Consecutive sends are `sendDelayMin..sendDelayMax` seconds apart.
 * - No more than `dailySendLimit` sends land on any day (counting the leads
 *   already sent today via `sentToday`).
 * - Sends only happen inside the working-hours window; a run that overruns a
 *   window or hits the daily cap rolls over to the next window.
 */
export function computeSendTimes(input: SendTimesInput): Date[] {
  const { count, settings, sentToday = 0, random = Math.random } = input;
  const now = input.now ?? new Date();
  const times: Date[] = [];
  let cursor = new Date(now.getTime());
  let sent = sentToday;
  let dayKey = zonedDayKey(cursor, settings.timezone);

  for (let i = 0; i < count; i += 1) {
    // Move to an allowed slot if we're outside the window or over the cap.
    if (!isWithinWorkingHours(cursor, settings)) {
      const next = nextWindowStart(cursor, settings);
      cursor = next;
      sent = 0;
      dayKey = zonedDayKey(cursor, settings.timezone);
    } else if (sent >= settings.dailySendLimit) {
      const next = nextWindowStart(cursor, settings);
      cursor = next;
      sent = 0;
      dayKey = zonedDayKey(cursor, settings.timezone);
    }

    times.push(new Date(cursor.getTime()));

    // Advance by the configured delay window.
    const delaySec = randBetween(
      settings.sendDelayMin,
      settings.sendDelayMax,
      random,
    );
    cursor = new Date(cursor.getTime() + delaySec * 1000);
    sent += 1;

    // Reset the daily counter when the cursor crosses into a new day.
    const nextKey = zonedDayKey(cursor, settings.timezone);
    if (nextKey !== dayKey) {
      dayKey = nextKey;
      sent = 0;
    }
  }

  return times;
}

/** ms a scheduled send is away from now (≥0), for enqueue `delayMs`. */
export function delayUntil(sendAt: Date, now: Date = new Date()): number {
  return Math.max(0, sendAt.getTime() - now.getTime());
}

/** Start of the day (00:00 in `timezone`) that `date` falls on, as an instant. */
export function startOfDayInTimezone(date: Date, timezone: string): Date {
  const p = zonedParts(date, timezone);
  return zonedToUtc({ ...p, hour: 0, minute: 0 }, timezone);
}

/** Convenience: campaign defaults for a fresh/unsaved campaign. */
export function defaultSendSettings(): SendSettings {
  return {
    timezone: "UTC",
    workingHoursStart: "09:00",
    workingHoursEnd: "18:00",
    sendDelayMin: 60,
    sendDelayMax: 120,
    dailySendLimit: env.EMAIL_DEFAULT_DAILY_LIMIT,
  };
}