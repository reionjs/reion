import type { Runtime } from "../core/runtime.js";
import type { MiddlewareResolver } from "../middleware/middlewareResolver.js";
import type { Middleware } from "../middleware/middlewareRunner.js";
import type { ScannedMiddleware } from "../loader/fileScanner.js";
import type { ScannedRoute } from "../loader/fileScanner.js";
import type { LoadedRoute } from "../router/routeLoader.js";
import type { ResolvedRoute } from "../router/router.js";
import type { RadixTree, RadixTreePerMethod } from "../router/radixTree.js";
import type { EventBus } from "../events/eventBus.js";
import type { ReionContext } from "../core/context.js";
import type { CompiledCors } from "../cors/cors.js";
import type { ResponseSchemaMap } from "../validation/routeSchema.js";
import type { CompiledSecurity } from "../security/types.js";

export type TurboPlan = {
  middlewarePath: string;
  route: ResolvedRoute["route"];
  middleware: Middleware[];
  rawBody: boolean;
  mergedResponseSchema: ResponseSchemaMap | undefined;
  defaultStatus: number;
  pipeline: (ctx: ReionContext) => unknown | Promise<unknown>;
  routeId: string | null;
};

type CachedMiddleware = Middleware[] | Promise<Middleware[]>;

type CachedRoute = LoadedRoute | null | Promise<LoadedRoute | null>;
type AnyCache = Map<unknown, unknown> | WeakMap<object, unknown>;
type CacheKeys<T> = {
  [K in keyof T]-?: T[K] extends AnyCache ? K : never;
}[keyof T];

export class CacheStore {
  // ---- server/runtime caches ----
  runtimeCache = new Map<string, Runtime | Promise<Runtime>>();
  /**
   * WeakMap keys are the request handler options object identity.
   * (Keep key type as object to avoid a runtime import cycle with requestHandler.ts.)
   */
  runtimeByOptions = new WeakMap<object, Runtime | Promise<Runtime>>();
  compiledOptionsCache = new WeakMap<object, { cors: CompiledCors; security: CompiledSecurity }>();

  turboPlanCache = new Map<string, TurboPlan>();

  // ---- pipeline caches ----
  pipelineCache = new Map<
    string,
    (ctx: ReionContext) => unknown | Promise<unknown>
  >();

  // ---- middleware caches ----
  middlewareTableCache = new Map<string, ScannedMiddleware[]>();
  middlewarePrefixIndexCache = new Map<string, Map<string, string[]>>();
  middlewareCache = new Map<string, CachedMiddleware>();
  middlewareResolverCache = new Map<string, MiddlewareResolver>();

  // ---- router/route caches ----
  routeTableCache = new Map<string, ScannedRoute[]>();
  radixCache = new Map<string, RadixTree>();
  /** Per-method trees (find-my-way style): key = `${appDir}\0${method}` */
  radixPerMethodCache = new Map<string, RadixTreePerMethod>();

  routeCache = new Map<string, CachedRoute>();
  /** Cached resolved route for static routes (no params). */
  staticResolvedCache = new Map<string, ResolvedRoute>();

  // ---- events caches ----
  eventBusCache = new Map<string, EventBus>();

  // ---- json/stringify caches ----
  serializerCache = new Map<string, (data: unknown) => string>();
  serializerByShape = new WeakMap<object, (data: unknown) => string>();

  getCache<K extends CacheKeys<CacheStore>>(name: K): CacheStore[K] {
    return this[name];
  }

  getFromCache<K extends CacheKeys<CacheStore>>(
    name: K,
    key: unknown,
  ): unknown {
    const selected = this.getCache(name);
    if (selected instanceof Map) return (selected as Map<unknown, unknown>).get(key);
    if (selected instanceof WeakMap && key !== null && typeof key === "object") {
      return selected.get(key);
    }
    return undefined;
  }

  setInCache<K extends CacheKeys<CacheStore>>(
    name: K,
    key: unknown,
    value: unknown,
  ): void {
    const selected = this.getCache(name);
    if (selected instanceof Map) {
      (selected as Map<unknown, unknown>).set(key, value);
      return;
    }
    if (selected instanceof WeakMap && key !== null && typeof key === "object") {
      (selected as WeakMap<object, unknown>).set(key, value);
    }
  }

  removeFromCache<K extends CacheKeys<CacheStore>>(name: K, key: unknown): boolean {
    const selected = this.getCache(name);
    if (selected instanceof Map) return (selected as Map<unknown, unknown>).delete(key);
    if (selected instanceof WeakMap && key !== null && typeof key === "object") {
      return selected.delete(key);
    }
    return false;
  }

  clearCache<K extends CacheKeys<CacheStore>>(name: K): void {
    const selected = this.getCache(name);
    if (selected instanceof Map) {
      selected.clear();
      return;
    }
    (this as Record<string, unknown>)[name as string] = new WeakMap<object, unknown>();
  }
}

export const cache = new CacheStore();
