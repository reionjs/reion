import { dirname, relative, resolve } from "node:path";
import { getRadixTreeForMethod, getRouteTable, addRouteFileToTable } from "./routeTable.js";
import { loadRoute, type LoadedRoute } from "./routeLoader.js";
import { cache } from "../cache/cache.js";

/** Route + params without spreading LoadedRoute (avoids allocation). Catch-all params are string[]. */
export type ResolvedRoute = {
  route: LoadedRoute;
  params: Record<string, string | string[]>;
  /** Group-aware pathname derived from file path for middleware resolution. */
  middlewarePath: string;
};

type CachedRoute = LoadedRoute | null | Promise<LoadedRoute | null>;

function routeCacheKey(appDir: string, filePath: string, method: string): string {
  return `${appDir}\0${filePath}\0${method}`;
}

function isPromise(v: CachedRoute): v is Promise<LoadedRoute | null> {
  return typeof (v as Promise<LoadedRoute | null>)?.then === "function";
}

function getMiddlewarePathFromFile(appDir: string, filePath: string): string {
  const routerBase = resolve(appDir, "router");
  const routeDir = dirname(resolve(filePath));
  const rel = relative(routerBase, routeDir).replace(/\\/g, "/");
  if (!rel || rel === ".") return "/";
  return "/" + rel;
}

/**
 * Resolve route using per-method radix tree (find-my-way style): one tree per HTTP method,
 * direct filePath from match, no method map lookup.
 */
export function resolveRoute(
  method: string,
  pathname: string,
  appDir: string
): ResolvedRoute | null | Promise<ResolvedRoute | null> {
  const tree = getRadixTreeForMethod(appDir, method);
  const match = tree.match(pathname);
  if (!match) return null;

  const key = routeCacheKey(appDir, match.filePath, method);
  const middlewarePath = getMiddlewarePathFromFile(appDir, match.filePath);
  const cached = cache.getFromCache("routeCache", key) as CachedRoute | undefined;
  if (cached !== undefined && !isPromise(cached)) {
    if (!cached) return null;
    const paramCount = Object.keys(match.params).length;
    if (paramCount === 0) {
      let resolved = cache.getFromCache("staticResolvedCache", key) as
        | ResolvedRoute
        | undefined;
      if (!resolved) {
        resolved = {
          route: cached,
          params: Object.create(null) as Record<string, string | string[]>,
          middlewarePath
        };
        cache.setInCache("staticResolvedCache", key, resolved);
      }
      return resolved;
    }
    return { route: cached, params: match.params, middlewarePath };
  }
  let loadPromise: Promise<LoadedRoute | null>;
  if (cached !== undefined && isPromise(cached)) {
    loadPromise = cached;
  } else {
    loadPromise = loadRoute(match.filePath, method, match.routeId);
    cache.setInCache("routeCache", key, loadPromise);
  }
  return loadPromise.then((loaded) => {
    cache.setInCache("routeCache", key, loaded);
    if (!loaded) return null;
    return { route: loaded, params: match.params, middlewarePath };
  });
}

/** Preload all routes and warm per-method radix trees so resolveRoute is sync. */
export async function preloadRoutes(appDir: string): Promise<void> {
  const table = getRouteTable(appDir);
  const byPath = new Map<string, Record<string, string>>();
  const methodsToWarm = new Set<string>();
  for (const r of table) {
    let fileByMethod = byPath.get(r.pathname);
    if (!fileByMethod) {
      fileByMethod = {};
      byPath.set(r.pathname, fileByMethod);
    }
    const m = r.method ?? "";
    fileByMethod[m] = r.filePath;
    if (m) methodsToWarm.add(m);
    else {
      methodsToWarm.add("");
      methodsToWarm.add("GET");
      methodsToWarm.add("POST");
      methodsToWarm.add("PUT");
      methodsToWarm.add("PATCH");
      methodsToWarm.add("DELETE");
      methodsToWarm.add("HEAD");
      methodsToWarm.add("OPTIONS");
    }
  }
  const promises: Promise<void>[] = [];
  for (const [pathname, fileByMethod] of byPath) {
    for (const [method, filePath] of Object.entries(fileByMethod)) {
      // route.ts (method "") exports GET, POST, etc. per method — only cache under "" so we load with the real HTTP method on first request
      const keys = method === "" ? [""] : [method];
      const key = routeCacheKey(appDir, filePath, keys[0]!);
      if (cache.getCache("routeCache").has(key)) continue;
      const p = loadRoute(filePath, method, pathname);
      for (const m of keys) cache.setInCache("routeCache", routeCacheKey(appDir, filePath, m), p);
      promises.push(p.then((loaded) => {
        for (const m of keys)
          cache.setInCache("routeCache", routeCacheKey(appDir, filePath, m), loaded);
      }));
    }
  }
  await Promise.all(promises);
  for (const method of methodsToWarm) {
    getRadixTreeForMethod(appDir, method);
  }
}

const ALL_METHODS = ["", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/** Reload handler cache for the given route file (dev hot reload). */
export async function reloadRoute(appDir: string, filePath: string): Promise<void> {
  const table = getRouteTable(appDir);
  const resolvedTarget = resolve(filePath);
  const entries = table.filter((r) => resolve(r.filePath) === resolvedTarget);
  if (entries.length === 0) {
    // New route file not yet in the route table: add it and rebuild caches lazily.
    addRouteFileToTable(appDir, filePath);
    return;
  }

  const filePathForKey = entries[0]!.filePath;
  const methodsToClear = new Set<string>();
  for (const r of entries) {
    const m = r.method ?? "";
    if (m) methodsToClear.add(m);
    else ALL_METHODS.forEach((x) => methodsToClear.add(x));
  }
  for (const m of methodsToClear) {
    const key = routeCacheKey(appDir, filePathForKey, m);
    cache.removeFromCache("routeCache", key);
    cache.removeFromCache("staticResolvedCache", key);
  }

  const promises: Promise<void>[] = [];
  const seen = new Set<string>();
  for (const r of entries) {
    const method = r.method ?? "";
    const keys = method === "" ? [""] : [method];
    const cacheKey = routeCacheKey(appDir, filePathForKey, keys[0]!);
    if (seen.has(cacheKey)) continue;
    seen.add(cacheKey);
    const p = loadRoute(r.filePath, method, r.pathname);
    for (const m of keys)
      cache.setInCache("routeCache", routeCacheKey(appDir, filePathForKey, m), p);
    promises.push(
      p.then((loaded) => {
        for (const m of keys)
          cache.setInCache("routeCache", routeCacheKey(appDir, filePathForKey, m), loaded);
      })
    );
  }
  await Promise.all(promises);
}
