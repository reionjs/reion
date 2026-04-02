import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { invalidateModuleCache } from "../loader/moduleCache.js";
import { createEventBus } from "./eventBus.js";
import type { EventBus, EventHandler } from "./eventBus.js";
import { cache } from "../cache/cache.js";

export async function getOrCreateEventBus(appDir: string): Promise<EventBus> {
  const key = resolve(appDir);
  let bus = cache.getFromCache("eventBusCache", key) as EventBus | undefined;
  if (bus) return bus;
  bus = createEventBus();
  await registerEventHandlersFromApp(bus, appDir);
  cache.setInCache("eventBusCache", key, bus);
  return bus;
}

export function clearEventBusCache(appDir?: string): void {
  if (appDir) cache.removeFromCache("eventBusCache", resolve(appDir));
  else cache.clearCache("eventBusCache");
}

/** More specific suffixes first so `name.event.ts` matches `.event.ts`, not `.ts`. */
const EVENT_EXTENSIONS = [
  ".event.ts",
  ".event.js",
  ".event.mts",
  ".event.mjs",
  ".ts",
  ".js",
  ".mts",
  ".mjs",
];
const EVENTS_DIR = "events";

/**
 * True when a dev watcher-relative path looks like a handler under `events/`
 * (e.g. `src/events/foo.event.ts`), matching what {@link registerEventHandlersFromApp} loads.
 */
export function isLikelyEventHandlerFilename(filename: string): boolean {
  const n = filename.replaceAll("\\", "/");
  if (n.endsWith(".d.ts")) return false;
  const underEvents =
    n.startsWith("events/") || n.includes("/events/");
  if (!underEvents) return false;
  return EVENT_EXTENSIONS.some((ext) => n.endsWith(ext));
}

export type ScannedEvent = { name: string; filePath: string };

function listEventHandlerFiles(eventsDir: string): Array<{ filePath: string; rel: string }> {
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
        const ext = EVENT_EXTENSIONS.find((e) => d.name.endsWith(e));
        if (!ext) continue;
        const rel = relative(eventsDir, full).replaceAll("\\", "/");
        out.push({ filePath: full, rel });
      }
    }
  }

  walk(eventsDir);
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return out;
}

/**
 * Dot.case event name from path under `events/`, e.g. `billing/invoicePaid.event.ts` → `billing.invoice.paid`.
 */
function eventNameFromRelativeEventPath(rel: string): string {
  const segments = rel.split("/").filter((p) => p.length > 0);
  if (segments.length === 0) return "";
  const fileName = segments[segments.length - 1]!;
  const ext = EVENT_EXTENSIONS.find((e) => fileName.endsWith(e));
  if (!ext) return "";
  const baseName = fileName.slice(0, -ext.length);
  const dirParts = segments.slice(0, -1);
  const pieces = [...dirParts, baseName]
    .map((s) => eventNameFromFile(s))
    .filter((s) => s.length > 0);
  return pieces.join(".");
}

/** List event handler files under `appDir/events/` (recursive) without loading modules. */
export function scanEventFiles(appDir: string): ScannedEvent[] {
  const eventsDir = resolve(appDir, EVENTS_DIR);
  const list: ScannedEvent[] = [];
  for (const { filePath, rel } of listEventHandlerFiles(eventsDir)) {
    const eventName = eventNameFromRelativeEventPath(rel);
    if (!eventName) continue;
    list.push({ name: eventName, filePath });
  }
  return list;
}

/** Convert one path segment / basename (e.g. userCreated) to dot.case (e.g. user.created). */
function eventNameFromFile(baseName: string): string {
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

export async function registerEventHandlersFromApp(bus: EventBus, appDir: string): Promise<void> {
  const eventsDir = resolve(appDir, EVENTS_DIR);

  for (const { filePath, rel } of listEventHandlerFiles(eventsDir)) {
    const eventName = eventNameFromRelativeEventPath(rel);
    if (!eventName) continue;

    try {
      const bust = process.env.REION_EVENT_RELOAD_TOKEN;
      if (bust) invalidateModuleCache(filePath);
      const url = pathToFileURL(filePath).href;
      const importUrl = bust ? `${url}?t=${bust}` : url;
      const mod = await import(importUrl);
      const handler = mod.default;
      if (typeof handler !== "function") continue;
      bus.on(eventName, handler as EventHandler);
    } catch {
      // skip invalid or failing modules
    }
  }
}
