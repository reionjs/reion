import type { ReionContext } from "../core/context.js";
import type { LoadedRoute } from "../router/routeLoader.js";
import type { Middleware } from "../middleware/middlewareRunner.js";
import { mergeRouteSchema } from "../validation/routeSchema.js";
import {
  compileRouteValidators,
  validateRouteWithCompiled,
  ValidationError,
} from "../validation/routeSchema.js";
import { compose } from "./compose.js";
import { cache } from "../cache/cache.js";

function pipelineCacheKey(appDir: string, pathname: string, method: string): string {
  return `${appDir}\0${pathname}\0${method}`;
}

export type PipelineEntry = {
  pathname: string;
  method: string;
  route: LoadedRoute;
  middleware: Middleware[];
};

/** Validation as middleware: throws ValidationError on failure, else assigns and calls next(). */
function createValidationMiddleware(
  mergedSchema: ReturnType<typeof mergeRouteSchema>,
  method: string
): Middleware {
  const compiled = compileRouteValidators(mergedSchema);
  return (ctx: ReionContext, next: () => Promise<void>) => {
    const v = validateRouteWithCompiled(compiled, method, {
      body: ctx.body,
      params: ctx.params,
      query: ctx.query
    });
    if (!v.ok) throw new ValidationError(v.status, v.json);
    if ("body" in v && v.body !== undefined) ctx.body = v.body;
    if ("params" in v && v.params !== undefined) ctx.params = v.params;
    if ("query" in v && v.query !== undefined) ctx.query = v.query;
    return next();
  };
}

/** Returns a compiled pipeline (validation? + middleware + handler). Never throws; rejects on error. */
export function getOrCreatePipeline(
  appDir: string,
  pathname: string,
  method: string,
  route: LoadedRoute,
  middleware: Middleware[]
): (ctx: ReionContext) => unknown | Promise<unknown> {
  const key = pipelineCacheKey(appDir, pathname, method);
  let fn = cache.getFromCache("pipelineCache", key) as
    | ((ctx: ReionContext) => unknown | Promise<unknown>)
    | undefined;
  if (fn) return fn;
  const mergedSchema = mergeRouteSchema(route.schema, route.methodSchema);
  const hasValidation = !!(mergedSchema.body ?? mergedSchema.params ?? mergedSchema.query);
  const handler = (ctx: ReionContext) => route.handler(ctx);
  const mwList = hasValidation
    ? [createValidationMiddleware(mergedSchema, method), ...middleware]
    : middleware.length > 0 ? middleware : [];
  const composed = compose(mwList, handler);
  fn = (ctx: ReionContext): unknown | Promise<unknown> => {
    try {
      return composed(ctx);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  cache.setInCache("pipelineCache", key, fn);
  return fn;
}

/** Preload pipelines for the given entries (call after preloadRoutes + preloadMiddleware). */
export function preloadPipelines(appDir: string, entries: PipelineEntry[]): void {
  for (const { pathname, method, route, middleware } of entries) {
    getOrCreatePipeline(appDir, pathname, method, route, middleware);
  }
}

const ALL_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function clearPipelineForRoute(appDir: string, pathname: string, method: string): void {
  if (method === "") {
    for (const m of ALL_HTTP_METHODS)
      cache.removeFromCache("pipelineCache", pipelineCacheKey(appDir, pathname, m));
  } else {
    cache.removeFromCache("pipelineCache", pipelineCacheKey(appDir, pathname, method));
  }
}

export function clearPipelineCache(appDir: string): void {
  const prefix = appDir + "\0";
  const pipeline = cache.getCache("pipelineCache");
  for (const key of pipeline.keys()) {
    if (key.startsWith(prefix)) cache.removeFromCache("pipelineCache", key);
  }
}
