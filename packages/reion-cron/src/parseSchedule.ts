import type { ScheduleDef } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

function parseTime(at: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(at.trim());
  if (!match) return { hours: 0, minutes: 0 };
  return {
    hours: Math.min(23, Math.max(0, parseInt(match[1]!, 10))),
    minutes: Math.min(59, Math.max(0, parseInt(match[2]!, 10)))
  };
}

/** Parse interval string like "5m", "10s", "1h" to ms. */
function parseIntervalEvery(every: string): number | null {
  const s = every.trim().toLowerCase();
  const match = /^(\d+)\s*(s|sec|m|min|h|hr|d|day)s?$/.exec(s);
  if (match) {
    const n = parseInt(match[1]!, 10);
    const unit = match[2];
    if (unit === "s" || unit === "sec") return n * 1000;
    if (unit === "m" || unit === "min") return n * MINUTE_MS;
    if (unit === "h" || unit === "hr") return n * HOUR_MS;
    if (unit === "d" || unit === "day") return n * DAY_MS;
  }
  if (s === "minute" || s === "1m") return MINUTE_MS;
  if (s === "hour" || s === "1h") return HOUR_MS;
  return null;
}

/**
 * Returns interval in ms for setInterval, or null if this is an "at" schedule (day/week/month).
 */
export function getIntervalMs(def: ScheduleDef): number | null {
  if (def.every === "minute") return MINUTE_MS;
  if (def.every === "hour") return HOUR_MS;
  const interval = parseIntervalEvery(def.every);
  if (interval !== null) return interval;
  return null;
}

/**
 * Returns true if this schedule runs at a specific time (day at, week day at, month date at).
 */
export function isAtSchedule(def: ScheduleDef): boolean {
  if (def.every === "day" && "at" in def) return true;
  if (def.every === "week") return true;
  if (def.every === "month") return true;
  return false;
}

/**
 * Get ms until the next run for "at" schedules (day at HH:MM, week day at HH:MM, month date at HH:MM).
 * Never returns 0 so we avoid setTimeout(..., 0) and immediate re-runs.
 */
export function getNextRunMs(def: ScheduleDef): number {
  const now = new Date();
  const at = "at" in def && typeof (def as any).at === "string" ? (def as any).at : "00:00";
  const { hours, minutes } = parseTime(at);

  let ms: number;

  if (def.every === "day") {
    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= now.getTime()) next = new Date(next.getTime() + DAY_MS);
    ms = next.getTime() - now.getTime();
  } else if (def.every === "week") {
    const dayName = (def as any).day ?? "monday";
    const targetDay = WEEKDAYS[dayName.toLowerCase()] ?? 1;
    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    let diff = targetDay - next.getDay();
    if (diff < 0) diff += 7;
    else if (diff === 0 && next.getTime() <= now.getTime()) diff = 7;
    next = new Date(next.getTime() + diff * DAY_MS);
    ms = next.getTime() - now.getTime();
  } else if (def.every === "month") {
    const date = (def as any).date ?? 1;
    let next = new Date(now.getFullYear(), now.getMonth(), date, hours, minutes, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next = new Date(now.getFullYear(), now.getMonth() + 1, date, hours, minutes, 0, 0);
    }
    ms = next.getTime() - now.getTime();
  } else {
    ms = DAY_MS;
  }

  return Math.max(1, ms);
}
