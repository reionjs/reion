import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { invalidateModuleCache } from "../loader/moduleCache.js";
import type { SecurityConfig } from "./types.js";

const SECURITY_FILES = ["security.ts", "security.js", "security.mts", "security.mjs"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

type ScannedSecurity = { pathPrefix: string; filePath: string };

const tableCache = new Map<string, ScannedSecurity[]>();
const resolvedCache = new Map<string, Promise<SecurityConfig | undefined> | SecurityConfig | undefined>();

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeSecurity(base: SecurityConfig | undefined, route: SecurityConfig | undefined): SecurityConfig | undefined {
  if (!base && !route) return undefined;
  if (!base) return route;
  if (!route) return base;
  const out: SecurityConfig = { ...base };
  const keys: Array<keyof SecurityConfig> = [
    "rateLimit",
    "headers",
    "requestSize",
    "ipFilter",
    "csrf",
    "timeout"
  ];
  for (const k of keys) {
    const b = base[k];
    const r = route[k];
    if (isObject(b) && isObject(r)) out[k] = { ...b, ...r } as any;
    else if (r !== undefined) out[k] = r as any;
    else out[k] = b as any;
  }
  return out;
}

function pathnameToPrefixes(pathname: string): string[] {
  const normalized = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!normalized) return [""];
  const segments = normalized.split("/").filter(Boolean);
  const prefixes: string[] = [""];
  let acc = "";
  for (const s of segments) {
    acc = acc ? `${acc}/${s}` : s;
    prefixes.push(acc);
  }
  return prefixes;
}

function scanSecurityFiles(appDir: string): ScannedSecurity[] {
  const cached = tableCache.get(appDir);
  if (cached) return cached;
  const base = resolve(appDir, "router");
  const list: ScannedSecurity[] = [];
  function walk(dir: string, segments: string[]) {
    let entries: { name: string; isFile?: boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isFile: e.isFile()
      }));
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const seg = [...segments, entry.name];
      if (entry.isFile) {
        if (SECURITY_FILES.includes(entry.name)) {
          list.push({ pathPrefix: segments.join("/"), filePath: fullPath });
        }
      } else {
        walk(fullPath, seg);
      }
    }
  }
  walk(base, []);
  tableCache.set(appDir, list);
  return list;
}

/** Fast check used by the request hot path to skip security resolution entirely when none exist. */
export function hasAnySecurityFiles(appDir: string): boolean {
  return scanSecurityFiles(appDir).length > 0;
}

async function loadSecurityModule(filePath: string, method: string): Promise<SecurityConfig | undefined> {
  try {
    const bust = process.env.REION_SECURITY_RELOAD_TOKEN;
    if (bust) invalidateModuleCache(filePath);
    const url = pathToFileURL(filePath).href;
    const importUrl = bust ? `${url}?t=${bust}` : url;
    const mod = await import(importUrl);
    const securityConfig = (mod.security ?? mod.default) as
      | SecurityConfig
      | undefined;
    const methodSecurity =
      METHODS.includes(method as any) ? (mod[`${method}_SECURITY`] as SecurityConfig | undefined) : undefined;
    return mergeSecurity(securityConfig, methodSecurity);
  } catch {
    return undefined;
  }
}

export async function resolveRouteSecurityConfig(
  appDir: string,
  pathname: string,
  method: string
): Promise<SecurityConfig | undefined> {
  const key = `${appDir}\0${pathname}\0${method}`;
  const cached = resolvedCache.get(key);
  if (cached !== undefined) {
    return typeof (cached as Promise<SecurityConfig | undefined>).then === "function"
      ? await (cached as Promise<SecurityConfig | undefined>)
      : (cached as SecurityConfig | undefined);
  }
  const p = (async () => {
    const index = scanSecurityFiles(appDir);
    const prefixes = pathnameToPrefixes(pathname);
    let out: SecurityConfig | undefined;
    for (const prefix of prefixes) {
      const entry = index.find((s) => s.pathPrefix === prefix);
      if (!entry) continue;
      const cfg = await loadSecurityModule(entry.filePath, method);
      out = mergeSecurity(out, cfg);
    }
    return out;
  })();
  resolvedCache.set(key, p);
  const result = await p;
  resolvedCache.set(key, result);
  return result;
}

export function clearRouteSecurityConfigCache(appDir?: string): void {
  if (!appDir) {
    tableCache.clear();
    resolvedCache.clear();
    return;
  }
  tableCache.delete(appDir);
  const prefix = `${appDir}\0`;
  for (const key of resolvedCache.keys()) {
    if (key.startsWith(prefix)) resolvedCache.delete(key);
  }
}

