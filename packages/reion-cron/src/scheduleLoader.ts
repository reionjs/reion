import { readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { invalidateModuleCache } from "./moduleCache.js";
import type {
  Schedule,
  ScheduleDef,
  LoadedTask,
  TaskRunFn,
  TaskContext,
} from "./types.js";

export const CRON_EXTENSIONS = [
  ".cron.ts",
  ".cron.js",
  ".cron.mts",
  ".cron.mjs",
  ".cron.cjs",
  ".ts",
  ".js",
  ".mts",
  ".mjs",
  ".cjs",
];
const CRON_DIR = "cron";

/** One path segment / basename (e.g. `billing`, `invoicePaid`) → dot.case (matches events under `events/`). */
function cronSegmentToDotCase(baseName: string): string {
  if (!baseName.length) return "";
  const parts: string[] = [];
  let current = baseName[0]!.toLowerCase();
  for (let i = 1; i < baseName.length; i++) {
    const c = baseName[i]!;
    if (c >= "A" && c <= "Z") {
      parts.push(current);
      current = c.toLowerCase();
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts.join(".");
}

/** Convert task name (e.g. intervalExample) to schedule name (e.g. interval.example). */
function toScheduleName(name: string): string {
  return cronSegmentToDotCase(name);
}

export type ScheduleRunnerFn = (
  name: string,
  payload?: unknown,
) => void | Promise<void>;

const scheduleRunnerCache = new Map<string, ScheduleRunnerFn>();

/** Build a runner that invokes a schedule's run by name (e.g. "interval.example"). */
export function createScheduleRunner(tasks: LoadedTask[]): ScheduleRunnerFn {
  const byName = new Map<string, LoadedTask>();
  for (const task of tasks) {
    byName.set(toScheduleName(task.name), task);
  }
  return (name: string, payload?: unknown) => {
    const task = byName.get(name);
    if (!task) {
      console.warn(`[reion] schedule not found: "${name}"`);
      return;
    }
    const ctx: TaskContext = { payload };
    return Promise.resolve(task.run(ctx));
  };
}

export async function getOrCreateScheduleRunner(
  appDir: string,
): Promise<ScheduleRunnerFn> {
  const key = resolve(appDir);
  let runner = scheduleRunnerCache.get(key);
  if (runner) return runner;
  const cacheBust =
    typeof process !== "undefined"
      ? process.env.REION_CRON_RELOAD_TOKEN
      : undefined;
  const tasks = await loadSchedulesFromApp(appDir, cacheBust);
  runner = createScheduleRunner(tasks);
  scheduleRunnerCache.set(key, runner);
  return runner;
}

export function clearScheduleRunnerCache(appDir?: string): void {
  if (appDir) scheduleRunnerCache.delete(resolve(appDir));
  else scheduleRunnerCache.clear();
}

function normalizeSchedule(schedule: Schedule): ScheduleDef[] {
  if (Array.isArray(schedule)) return schedule;
  return [schedule];
}

export type ScannedSchedule = { name: string; filePath: string };

function listCronFiles(
  cronDir: string,
): Array<{ filePath: string; rel: string }> {
  const out: Array<{ filePath: string; rel: string }> = [];

  function walk(current: string): void {
    let dirents;
    try {
      dirents = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      const full = join(current, d.name);
      if (d.isDirectory()) {
        walk(full);
      } else if (d.isFile()) {
        if (d.name.endsWith(".d.ts")) continue;
        const ext = CRON_EXTENSIONS.find((e) => d.name.endsWith(e));
        if (!ext) continue;
        const rel = relative(cronDir, full).replaceAll("\\", "/");
        out.push({ filePath: full, rel });
      }
    }
  }

  walk(cronDir);
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

/**
 * Dot.case schedule id from path under `cron/`, e.g. `billing/syncOrders.cron.ts` → `billing.sync.orders`.
 * Used as the default task name when the module does not export `name`.
 */
function scheduleNameFromRelativeCronPath(rel: string): string {
  const segments = rel.split("/").filter((p) => p.length > 0);
  if (segments.length === 0) return "";
  const fileName = segments[segments.length - 1]!;
  const ext = CRON_EXTENSIONS.find((e) => fileName.endsWith(e));
  if (!ext) return "";
  const baseName = fileName.slice(0, -ext.length);
  const dirParts = segments.slice(0, -1);
  const pieces = [...dirParts, baseName]
    .map((s) => cronSegmentToDotCase(s))
    .filter((s) => s.length > 0);
  return pieces.join(".");
}

/** List `*.cron.*` files under `appDir/cron/` recursively (same idea as `scanEventFiles`). */
export function scanScheduleFiles(appDir: string): ScannedSchedule[] {
  const cronDir = resolve(appDir, CRON_DIR);
  const list: ScannedSchedule[] = [];
  for (const { filePath, rel } of listCronFiles(cronDir)) {
    const name = scheduleNameFromRelativeCronPath(rel);
    if (!name) continue;
    list.push({ name, filePath });
  }
  return list;
}

export async function loadScheduleModule(
  filePath: string,
  cacheBust?: string,
  /** From {@link scanScheduleFiles} when set (path-based default, supports nested `cron/`). */
  defaultNameFromPath?: string,
): Promise<LoadedTask | null> {
  try {
    if (cacheBust) invalidateModuleCache(filePath);
    const url = pathToFileURL(filePath).href;
    const importUrl = cacheBust ? `${url}?t=${cacheBust}` : url;
    const mod = await import(importUrl);
    const schedule = mod.schedule;
    const run = mod.run;
    if (schedule == null || typeof run !== "function") return null;
    const scheduleList = normalizeSchedule(schedule as Schedule);
    const fallbackBasename =
      basename(filePath).replace(/\.cron\.(ts|js|mts|mjs)$/i, "") || "task";
    const name =
      (mod.name ?? defaultNameFromPath ?? fallbackBasename) || "task";
    return {
      name,
      schedule: scheduleList,
      run: run as TaskRunFn,
    };
  } catch {
    return null;
  }
}

export async function loadSchedulesFromApp(
  appDir: string,
  cacheBust?: string,
): Promise<LoadedTask[]> {
  const scanned = scanScheduleFiles(appDir);
  const tasks: LoadedTask[] = [];
  for (const { filePath, name: pathDefaultName } of scanned) {
    const task = await loadScheduleModule(filePath, cacheBust, pathDefaultName);
    if (task) tasks.push(task);
  }
  return tasks;
}
