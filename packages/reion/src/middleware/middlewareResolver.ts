import type { Middleware } from "./middlewareRunner.js";
import { getMiddlewarePathsForPathname } from "./middlewareTable.js";
import { loadMiddlewareFromFile } from "./middlewareLoader.js";
import { cache } from "../cache/cache.js";

type CachedMiddleware = Middleware[] | Promise<Middleware[]>;

function middlewareCacheKey(appDir: string, pathname: string, method: string): string {
  return `${appDir}\0${pathname}\0${method}`;
}

function isPromise(v: CachedMiddleware): v is Promise<Middleware[]> {
  return typeof (v as Promise<Middleware[]>)?.then === "function";
}

export type MiddlewareResolver = {
  resolveForPathname: (pathname: string, method: string) => Middleware[] | Promise<Middleware[]>;
};

export function createMiddlewareResolver(appDir: string): MiddlewareResolver {
  return {
    resolveForPathname(pathname: string, method: string): Middleware[] | Promise<Middleware[]> {      const key = middlewareCacheKey(appDir, pathname, method);
      const cached = cache.getFromCache("middlewareCache", key) as
        | CachedMiddleware
        | undefined;
      if (cached !== undefined && !isPromise(cached)) return cached;
      let promise: Promise<Middleware[]>;
      if (cached !== undefined && isPromise(cached)) {
        promise = cached;
      } else {
        promise = (async () => {
          const paths = getMiddlewarePathsForPathname(pathname, appDir);
          const all: Middleware[] = [];
          for (const filePath of paths) {
            const fns = await loadMiddlewareFromFile(filePath, method);
            all.push(...fns);
          }
          return all;
        })();
        cache.setInCache("middlewareCache", key, promise);
      }
      return promise.then((arr) => {
        cache.setInCache("middlewareCache", key, arr);
        return arr;
      });
    }
  };
}

export function clearMiddlewareResolverCache(appDir?: string): void {
  if (appDir !== undefined) {
    cache.removeFromCache("middlewareResolverCache", appDir);
    const prefix = appDir + "\0";
    const middlewareCacheMap = cache.getCache("middlewareCache");
    for (const key of middlewareCacheMap.keys()) {
      if (key.startsWith(prefix)) cache.removeFromCache("middlewareCache", key);
    }
  } else {
    cache.clearCache("middlewareResolverCache");
    cache.clearCache("middlewareCache");
  }
}

export function getOrCreateMiddlewareResolver(appDir: string): MiddlewareResolver {
  let r = cache.getFromCache("middlewareResolverCache", appDir) as
    | MiddlewareResolver
    | undefined;
  if (!r) {
    r = createMiddlewareResolver(appDir);
    cache.setInCache("middlewareResolverCache", appDir, r);
  }
  return r;
}

/** Pathname + method pairs to preload (e.g. from route table). */
export async function preloadMiddleware(
  appDir: string,
  pathnameMethodPairs: Array<{ pathname: string; method: string }>
): Promise<void> {
  const resolver = getOrCreateMiddlewareResolver(appDir);
  const promises = pathnameMethodPairs.map(({ pathname, method }) => {
    const result = resolver.resolveForPathname(pathname, method);
    return Array.isArray(result) ? Promise.resolve(result) : result;
  });
  await Promise.all(promises);
}
