/**
 * JSON-based schedule definition (no cron strings).
 * Supports: every minute/hour, every day at, every week day at, every month date at, or interval (e.g. "5m", "10s").
 */
export type ScheduleDef =
  | { every: "minute" }
  | { every: "hour" }
  | { every: "day"; at?: string }
  | { every: "week"; day?: string; at?: string }
  | { every: "month"; date?: number; at?: string }
  | { every: string };

/** One task can have multiple schedules. */
export type Schedule = ScheduleDef | ScheduleDef[];

export type TaskContext = {
  /** Reserved for app-specific services (e.g. db, reportService). */
  services?: Record<string, unknown>;
  /** Set when the schedule is triggered via ctx.schedule(name, payload). */
  payload?: unknown;
};

export type TaskRunFn = (ctx: TaskContext) => void | Promise<void>;

export type LoadedTask = {
  name: string;
  schedule: ScheduleDef[];
  run: TaskRunFn;
};
