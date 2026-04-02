import type { ReionPlugin } from "reion";

import {
  clearScheduleRunnerCache,
  getOrCreateScheduleRunner,
  loadSchedulesFromApp,
} from "./scheduleLoader.js";
import { runScheduler } from "./runScheduler.js";
import { CRON_EXTENSIONS } from "./scheduleLoader.js";

export type CronPluginOptions = {
  /** Disable scheduler in `disableDevCron` command (default: false). */
  disableDevCron?: boolean;
}

export type ScheduleWhenOptions = {
  /** Run at an absolute time (Date, epoch ms, or Date-parsable string). */
  at?: Date | number | string;
  /** Run after this delay (ms). */
  delayMs?: number;
};

export type ScheduleInvokeFn = (
  name: string,
  payload?: unknown,
  options?: ScheduleWhenOptions,
) => void | Promise<void>;

declare module "reion" {
  interface ReionContext {
    schedule: ScheduleInvokeFn;
  }
}

function parseAtMs(at: NonNullable<ScheduleWhenOptions["at"]>): number | null {
  if (typeof at === "number") return Number.isFinite(at) ? at : null;
  if (at instanceof Date) {
    const ms = at.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof at === "string") {
    const ms = Date.parse(at);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function isCronFile(filename?: string): boolean {
  if (!filename) return false;
  const normalized = filename.replaceAll("\\", "/");
  if (normalized.endsWith(".d.ts")) return false;
  const underCron =
    normalized.startsWith("cron/") || normalized.includes("/cron/");
  if (!underCron) return false;
  return CRON_EXTENSIONS.some((ext) => normalized.endsWith(ext))
}

export function Cron(options: CronPluginOptions = {}): ReionPlugin {
  const disableDevCron = options.disableDevCron === true;
  let stopScheduler: (() => void) | null = null;
  let currentAppDir = "";

  function attachSchedule(ctx: import("reion").ReionContext): void {
    ctx.schedule = async (name, payload, when) => {
      const appDir = currentAppDir;
      if (!appDir) return;
      const runner = await getOrCreateScheduleRunner(appDir);

      const delayMs =
        typeof when?.delayMs === "number" && Number.isFinite(when.delayMs)
          ? Math.max(0, when.delayMs)
          : null;
      const atMs = when?.at !== undefined ? parseAtMs(when.at) : null;

      if (delayMs === null && atMs === null) {
        await runner(name, payload);
        return;
      }

      const computedDelay =
        delayMs !== null ? delayMs : Math.max(0, (atMs ?? Date.now()) - Date.now());
      if (computedDelay <= 0) {
        await runner(name, payload);
        return;
      }
      setTimeout(() => {
        void runner(name, payload);
      }, computedDelay);
    };
  }

  async function startScheduler(appDir?: string, cacheBust = false): Promise<void> {
    if (!appDir) return;
    if (cacheBust) {
      process.env.REION_CRON_RELOAD_TOKEN = String(Date.now());
      clearScheduleRunnerCache(appDir);
    }
    stopScheduler?.();
    stopScheduler = null;
    currentAppDir = appDir;

    const tasks = await loadSchedulesFromApp(appDir, process.env.REION_CRON_RELOAD_TOKEN);
    if (tasks.length === 0) return;

    stopScheduler = runScheduler(tasks, {
      onError: (name, error) => {
        console.error(`[reion cron ${name}]`, error);
      }
    });
  }

  function stopCurrent(): void {
    stopScheduler?.();
    stopScheduler = null;
    if (currentAppDir) clearScheduleRunnerCache(currentAppDir);
  }

  return {
    name: "@reion/cron",
    onRequest(ctx) {
      attachSchedule(ctx);
    },
    async onDevStart(ctx) {
      // Keep appDir for manual ctx.schedule(...) even when dev scheduler is disabled.
      if (ctx.appDir) currentAppDir = ctx.appDir;
      if (disableDevCron) return;
      await startScheduler(ctx.appDir);
    },
    async onDevFileChange(ctx) {
      const changed = ctx.changedPath ?? ctx.filename;
      if (!isCronFile(changed)) return;
      // Manual schedule() uses the cached runner too; bust it on cron file changes.
      if (ctx.appDir) {
        currentAppDir = ctx.appDir;
        process.env.REION_CRON_RELOAD_TOKEN = String(Date.now());
        clearScheduleRunnerCache(ctx.appDir);
      }
      if (disableDevCron) return;
      await startScheduler(ctx.appDir, true);
    },
    onDevRestart() {
      stopCurrent();
    },
    onDevStop() {
      stopCurrent();
    },
    async onStartListening(ctx) {
      await startScheduler(ctx.appDir);
    },
    onStartStop() {
      stopCurrent();
    },
    onStartError() {
      stopCurrent();
    }
  };
}
