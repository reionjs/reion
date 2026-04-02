import type { ScannedMiddleware } from "../loader/fileScanner.js";
import { scanMiddlewareFiles } from "../loader/fileScanner.js";
import { cache } from "../cache/cache.js";

export function getMiddlewareTable(appDir: string): ScannedMiddleware[] {
  let table = cache.getFromCache("middlewareTableCache", appDir) as
    | ScannedMiddleware[]
    | undefined;
  if (!table) {
    table = scanMiddlewareFiles(appDir);
    cache.setInCache("middlewareTableCache", appDir, table);
  }
  return table;
}

function getPrefixIndex(appDir: string): Map<string, string[]> {
  let index = cache.getFromCache("middlewarePrefixIndexCache", appDir) as
    | Map<string, string[]>
    | undefined;
  if (index) return index;
  const table = getMiddlewareTable(appDir);
  index = new Map<string, string[]>();
  for (const m of table) {
    const existing = index.get(m.pathPrefix);
    if (existing) existing.push(m.filePath);
    else index.set(m.pathPrefix, [m.filePath]);
  }
  cache.setInCache("middlewarePrefixIndexCache", appDir, index);
  return index;
}

/** Pathname e.g. /api/hello -> path prefixes ["", "api", "api/hello"] */
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

/** Ordered list of middleware file paths for this pathname (ancestor first). Uses exact pathPrefix so group middleware (e.g. api/(user)) only runs for routes inside that group. */
export function getMiddlewarePathsForPathname(pathname: string, appDir: string): string[] {
  const index = getPrefixIndex(appDir);
  const prefixes = pathnameToPrefixes(pathname);
  const paths: string[] = [];
  for (const p of prefixes) {
    const forPrefix = index.get(p);
    if (forPrefix) paths.push(...forPrefix);
  }
  return paths;
}

export function clearMiddlewareTableCache(appDir?: string): void {
  if (appDir) {
    cache.removeFromCache("middlewareTableCache", appDir);
    cache.removeFromCache("middlewarePrefixIndexCache", appDir);
  } else {
    cache.clearCache("middlewareTableCache");
    cache.clearCache("middlewarePrefixIndexCache");
  }
}
