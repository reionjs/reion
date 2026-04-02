import type { ScannedRoute } from "../loader/fileScanner.js";
import { scanAppFiles, scanRouteFilesInDir } from "../loader/fileScanner.js";
import { dirname, resolve } from "node:path";
import type { RadixTree, RadixTreePerMethod } from "./radixTree.js";
import { buildRadixTree, buildRadixTreeForMethod } from "./radixTree.js";
import { getMethodsExportedByRouteFile } from "./routeLoader.js";
import { cache } from "../cache/cache.js";

function getRoutesDir(appDir: string): string {
  return resolve(appDir, "router");
}

function normalizeRoutePath(pathname: string): string {
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const withoutGroups = segments.filter(
    (s) => !(s.startsWith("(") && s.endsWith(")")),
  );
  return "/" + withoutGroups.join("/");
}

export type ValidateRouteConflictsOptions = {
  /**
   * When true (default), scan appDir recursively and validate all routes.
   * When false, scan only appDir (that directory only, no nested subdirs).
   */
  isRecursive?: boolean;
};

/**
 * For each path, collect which methods each file actually provides (by loading route.ts).
 * If any (path, method) has more than one file, throw.
 */
export async function validateRouteConflictsAsync(
  appDir: string,
  options: ValidateRouteConflictsOptions = {}
): Promise<void> {
  const { isRecursive = true } = options;
  const routesDir = getRoutesDir(appDir);
  const routes = isRecursive
    ? scanAppFiles(routesDir)
    : scanRouteFilesInDir(routesDir, routesDir);
  const byPath = new Map<string, ScannedRoute[]>();
  for (const route of routes) {
    const key = normalizeRoutePath(route.pathname);
    const list = byPath.get(key);
    if (list) list.push(route);
    else byPath.set(key, [route]);
  }

  for (const [normalizedPath, list] of byPath) {
    /** method -> file paths that provide it */
    const byMethod = new Map<string, string[]>();
    for (const r of list) {
      const m = r.method ?? "";
      const methods =
        m === "" ? await getMethodsExportedByRouteFile(r.filePath) : [m];
      for (const method of methods) {
        const files = byMethod.get(method) ?? [];
        files.push(r.filePath);
        byMethod.set(method, files);
      }
    }
    for (const [method, files] of byMethod) {
      if (files.length > 1) {
        throw new Error(
          `Duplicate handler for method ${method}.\nKeep only one method per route:\n ${files.join("\n")}`,
        );
      }
    }
  }
}

export function getRouteTable(appDir: string): ScannedRoute[] {
  let table = cache.getFromCache("routeTableCache", appDir) as
    | ScannedRoute[]
    | undefined;
  if (!table) {
    table = scanAppFiles(getRoutesDir(appDir));
    cache.setInCache("routeTableCache", appDir, table);
  }
  return table;
}

/** Radix tree for O(path depth) route lookup. Cached per appDir. */
export function getRadixTree(appDir: string): RadixTree {
  let tree = cache.getFromCache("radixCache", appDir) as RadixTree | undefined;
  if (!tree) {
    tree = buildRadixTree(getRouteTable(appDir));
    cache.setInCache("radixCache", appDir, tree);
  }
  return tree;
}

/** Per-method radix tree (find-my-way style): one tree per HTTP method, direct filePath in match. Cached per appDir+method. */
export function getRadixTreeForMethod(
  appDir: string,
  method: string,
): RadixTreePerMethod {
  const key = `${appDir}\0${method}`;
  let tree = cache.getFromCache("radixPerMethodCache", key) as
    | RadixTreePerMethod
    | undefined;
  if (!tree) {
    tree = buildRadixTreeForMethod(getRouteTable(appDir), method);
    cache.setInCache("radixPerMethodCache", key, tree);
  }
  return tree;
}

/** Add or refresh routes for a single route file and update radix caches lazily. */
export function addRouteFileToTable(appDir: string, filePath: string): void {
  const table = getRouteTable(appDir);
  const target = resolve(filePath);
  const dir = dirname(target);
  const routesDir = getRoutesDir(appDir);
  const scanned = scanRouteFilesInDir(routesDir, dir).filter(
    (r) => resolve(r.filePath) === target,
  );
  if (scanned.length === 0) return;

  // Merge new entries into the existing table, avoiding duplicates.
  for (const r of scanned) {
    const exists = table.some(
      (e) =>
        resolve(e.filePath) === resolve(r.filePath) &&
        (e.method ?? "") === (r.method ?? "") &&
        e.pathname === r.pathname,
    );
    if (!exists) table.push(r);
  }
  cache.setInCache("routeTableCache", appDir, table);

  // Invalidate radix trees for this appDir; they will rebuild on next access.
  cache.removeFromCache("radixCache", appDir);
  const radixPerMethod = cache.getCache("radixPerMethodCache");
  for (const key of radixPerMethod.keys()) {
    if (key.startsWith(appDir + "\0")) cache.removeFromCache("radixPerMethodCache", key);
  }
}

/** Remove all routes coming from a specific route file and invalidate radix caches. */
export function removeRouteFileFromTable(appDir: string, filePath: string): void {
  const target = resolve(filePath);
  const table = getRouteTable(appDir).filter(
    (r) => resolve(r.filePath) !== target,
  );
  cache.setInCache("routeTableCache", appDir, table);
  cache.removeFromCache("radixCache", appDir);
  const radixPerMethod = cache.getCache("radixPerMethodCache");
  for (const key of radixPerMethod.keys()) {
    if (key.startsWith(appDir + "\0")) cache.removeFromCache("radixPerMethodCache", key);
  }
}

export function clearRouteTableCache(appDir?: string): void {
  if (appDir) {
    cache.removeFromCache("routeTableCache", appDir);
    cache.removeFromCache("radixCache", appDir);
    const radixPerMethod = cache.getCache("radixPerMethodCache");
    for (const k of radixPerMethod.keys()) {
      if (k.startsWith(appDir + "\0")) cache.removeFromCache("radixPerMethodCache", k);
    }
  } else {
    cache.clearCache("routeTableCache");
    cache.clearCache("radixCache");
    cache.clearCache("radixPerMethodCache");
  }
}
