import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createRuntime } from "../core/runtime.js";
import type { Runtime } from "../core/runtime.js";
import type { ReionContext, Response } from "../core/context.js";
import { getDefaultStatusFromSchema, releaseContext } from "../core/context.js";
import type { CorsConfig, ErrorHandler } from "../config/loadConfig.js";
import type {
  ReionInitContext,
  ReionPlugin,
  InitRouteEntry,
} from "../plugin/pluginAPI.js";
import { parseBody } from "../body/parseBody.js";
import {
  applyCompiledCorsHeaders,
  compileCors,
  shouldRejectCompiledCorsRequest,
  type CompiledCors,
} from "../cors/cors.js";
import { getOrCreateEventBus, scanEventFiles } from "../events/eventExecutor.js";
import {
  getOrCreateMiddlewareResolver,
  preloadMiddleware,
} from "../middleware/middlewareResolver.js";
import { NextError, type Middleware } from "../middleware/middlewareRunner.js";
import {
  getOrCreatePipeline,
  preloadPipelines,
  type PipelineEntry,
} from "../pipeline/pipelineCache.js";
import {
  resolveRoute,
  preloadRoutes,
  type ResolvedRoute,
} from "../router/router.js";
import { getMethodsExportedByRouteFile } from "../router/routeLoader.js";
import { scanMiddlewareFiles } from "../loader/fileScanner.js";
import { getRouteTable } from "../router/routeTable.js";
import { getStringifier } from "../json/fastStringify.js";
import type { ResponseSchemaMap } from "../validation/routeSchema.js";
import { ValidationError } from "../validation/routeSchema.js";
import type { ReionLogger } from "../logger/requestLogger.js";
import {
  setBaseLogger,
  createPrettyLogger,
  getBaseLogger,
} from "../logger/requestLogger.js";
import type { TraceData, TraceStartData } from "../trace/traceEngine.js";
import type { TracerFn, TraceStartFn } from "../trace/traceEngine.js";
import { shouldIgnoreTracingPathname } from "../trace/tracingIgnore.js";
import { appLogger } from "../utils/logger.js";
import { defaultErrorHandler } from "./errorHandler.js";
import { cache, type TurboPlan } from "../cache/cache.js";
import { applySecurityGuards } from "../security/middleware.js";
import {
  compileSecurity,
  COMPILED_SECURITY_EMPTY,
} from "../security/compileSecurity.js";
import {
  hasAnySecurityFiles,
  resolveRouteSecurityConfig,
} from "../security/securityConfigLoader.js";

export function clearRuntimeCache(appDir?: string): void {
  if (appDir !== undefined) {
    const resolvedAppDir = resolve(appDir);
    cache.removeFromCache("runtimeCache", resolvedAppDir);
    clearTurboPlanCache(resolvedAppDir);
  } else {
    cache.clearCache("runtimeCache");
    clearTurboPlanCache();
  }
}

/** Warm runtime so first request gets sync lookup (Fastify-style: ready before accepting connections). */
export async function warmRuntime(
  options: RequestHandlerOptions,
): Promise<void> {
  const r = getOrCreateRuntime(options);
  if (typeof (r as Promise<Runtime>).then === "function") await r;
}

function getOrCreateRuntime(
  options: RequestHandlerOptions,
): Runtime | Promise<Runtime> {
  const appDir = options.appDir ?? "./src";
  const key = resolve(appDir);
  /** Prefer `runtimeCache` so `clearRuntimeCache(appDir)` invalidates the live server (see `runtimeByOptions` WeakMap). */
  const cached = cache.getFromCache("runtimeCache", key) as
    | Runtime
    | Promise<Runtime>
    | undefined;
  if (cached !== undefined) {
    cache.setInCache("runtimeByOptions", options, cached);
    if (typeof (cached as Promise<Runtime>).then === "function")
      return cached as Promise<Runtime>;
    return cached as Runtime;
  }
  const promise = (async () => {
    if (options.logger !== undefined) {
      setBaseLogger(options.logger);
    } else if (options.dev?.logPretty) {
      setBaseLogger(createPrettyLogger());
    }
    const eventBus = await getOrCreateEventBus(appDir);
    const ignore = options.tracingIgnorePathPrefixes;
    const tracer: TracerFn = options.tracer
      ? (data) => {
          if (shouldIgnoreTracingPathname(data.pathname, ignore)) return;
          defaultTracer(data);
          options.tracer!(data);
        }
      : (data) => {
          if (shouldIgnoreTracingPathname(data.pathname, ignore)) return;
          defaultTracer(data);
        };
    const traceStart: TraceStartFn = options.traceStart
      ? (data) => {
          if (shouldIgnoreTracingPathname(data.pathname, ignore)) return;
          defaultTraceStart(data);
          options.traceStart!(data);
        }
      : (data) => {
          if (shouldIgnoreTracingPathname(data.pathname, ignore)) return;
          defaultTraceStart(data);
        };
    const runtime = createRuntime({
      appDir: options.appDir,
      plugins: options.plugins ?? [],
      eventBus,
      tracer,
      traceStart,
      tracing: options.tracing !== false,
      ...(ignore !== undefined && { tracingIgnorePathPrefixes: ignore }),
      ...(options.contextPool !== undefined && {
        contextPool: options.contextPool,
      }),
    });
    await preloadRoutes(appDir);
    const table = getRouteTable(appDir);
    const byPath = new Map<string, Record<string, string>>();
    for (const r of table) {
      let fileByMethod = byPath.get(r.pathname);
      if (!fileByMethod) {
        fileByMethod = {};
        byPath.set(r.pathname, fileByMethod);
      }
      fileByMethod[r.method ?? ""] = r.filePath;
    }
    const pathnameMethodPairs = Array.from(byPath.entries()).flatMap(
      ([pathname, fileByMethod]) =>
        Object.keys(fileByMethod).map((method) => ({ pathname, method })),
    );
    await preloadMiddleware(appDir, pathnameMethodPairs);
    const middlewareResolver = getOrCreateMiddlewareResolver(appDir);
    const pipelineEntries: PipelineEntry[] = [];
    for (const { pathname, method } of pathnameMethodPairs) {
      const routeResult = resolveRoute(method, pathname, appDir);
      const route: ResolvedRoute | null =
        routeResult != null &&
        typeof (routeResult as Promise<unknown>).then === "function"
          ? await routeResult
          : (routeResult as ResolvedRoute | null);
      if (!route) continue;
      const mwResult = middlewareResolver.resolveForPathname(
        route.middlewarePath,
        method,
      );
      const middleware: Middleware[] =
        mwResult != null &&
        typeof (mwResult as Promise<unknown>).then === "function"
          ? await mwResult
          : (mwResult as Middleware[]);
      pipelineEntries.push({
        pathname: route.middlewarePath,
        method,
        route: route.route,
        middleware,
      });
    }
    preloadPipelines(appDir, pipelineEntries);
    const plugins = options.plugins ?? [];
    if (plugins.length > 0) {
      const initRoutes: InitRouteEntry[] = [];
      const seenRoutePair = new Set<string>();
      for (const r of table) {
        const methods =
          r.method && r.method.length > 0
            ? [r.method]
            : await getMethodsExportedByRouteFile(r.filePath);
        for (const method of methods) {
          if (!method || method.length === 0) continue;
          const dedupeKey = `${method}\0${r.pathname}\0${r.filePath}`;
          if (seenRoutePair.has(dedupeKey)) continue;
          seenRoutePair.add(dedupeKey);
          const routeResult = resolveRoute(method, r.pathname, appDir);
          const route: ResolvedRoute | null =
            routeResult != null &&
            typeof (routeResult as Promise<unknown>).then === "function"
              ? await routeResult
              : (routeResult as ResolvedRoute | null);
          if (!route) continue;
          const lr = route.route;
          const entry: InitRouteEntry = {
            pathname: r.pathname,
            filePath: r.filePath,
            method,
          };
          if (lr.schema != null) entry.schema = lr.schema;
          if (lr.methodSchema != null) entry.methodSchema = lr.methodSchema;
          if (lr.responseSchema != null) entry.responseSchema = lr.responseSchema;
          initRoutes.push(entry);
        }
      }
      const manifest: ReionInitContext = {
        appDir: key,
        routes: initRoutes,
        events: scanEventFiles(appDir),
        middlewares: scanMiddlewareFiles(appDir),
      };
      await runtime.runHook("init", manifest);
    }
    cache.setInCache("runtimeCache", key, runtime);
    cache.setInCache("runtimeByOptions", options, runtime);
    return runtime;
  })();
  cache.setInCache("runtimeCache", key, promise);
  cache.setInCache("runtimeByOptions", options, promise);
  return promise;
}

export type RequestHandlerOptions = {
  appDir?: string;
  maxBodySize?: number;
  errorHandler?: ErrorHandler;
  cors?: CorsConfig;
  plugins?: ReionPlugin[];
  /** Default response body schemas per status (from reion.config responses). */
  responses?: ResponseSchemaMap;
  /** Base logger for ctx.logger (request-scoped children will include traceId). */
  logger?: ReionLogger;
  /** Dev options from config (e.g. dev.logPretty for pino-pretty in development). */
  dev?: { logPretty?: boolean };
  /** Override default API tracing (span end). */
  tracer?: TracerFn;
  /** Override default API tracing (span start). */
  traceStart?: TraceStartFn;
  /** Set false to disable request lifecycle logging and tracer/traceStart callbacks (default: true). */
  tracing?: boolean;
  /** Set true to reuse context objects from a pool (may help under heavy load with many routes). */
  contextPool?: boolean;
  /**
   * Skip default + custom tracing for pathnames matching these prefixes (see ReionConfig).
   */
  tracingIgnorePathPrefixes?: string[];
};

function getCompiledRequestOptions(
  options: RequestHandlerOptions,
): { cors: CompiledCors } {
  const cached = cache.getFromCache("compiledOptionsCache", options) as
    | { cors: CompiledCors }
    | undefined;
  if (cached) return cached;
  const compiled = {
    cors: compileCors(options.cors),
  };
  cache.setInCache("compiledOptionsCache", options, compiled);
  return compiled;
}

function defaultTraceStart(data: TraceStartData): void {
  getBaseLogger()
    .child({ traceId: data.traceId })
    .info(
      {
        method: data.method,
        pathname: data.pathname,
        startTime: new Date(data.startTime).toISOString(),
      },
      "request started",
    );
}

function defaultTracer(data: TraceData): void {
  getBaseLogger()
    .child({ traceId: data.traceId })
    .info(
      {
        method: data.method,
        pathname: data.pathname,
        ...(data.statusCode != null && { statusCode: data.statusCode }),
        durationMs: data.durationMs,
        ...(data.routeId != null && { routeId: data.routeId }),
        ...(data.responseSize != null && { responseSize: data.responseSize }),
        ...(data.error != null && { error: data.error }),
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
      },
      "request completed",
    );
}

function toFrameworkResponse(result: unknown): Response {
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // Treat as framework Response only when it uses the response shape explicitly.
    if ("json" in obj) {
      return result as Response;
    }
    if ("body" in obj && ("status" in obj || "headers" in obj)) {
      return result as Response;
    }
  }
  return { json: result };
}

const HELLO_WORLD_JSON = Buffer.from('{"hello":"world"}', "utf8");
const NOT_FOUND_MSG = "Route not found" as const;
const INTERNAL_ERROR_JSON = Buffer.from(
  '{"error":"Internal Server Error"}',
  "utf8",
);
export function clearTurboPlanCache(appDir?: string): void {
  if (appDir === undefined) {
    cache.clearCache("turboPlanCache");
    return;
  }
  const prefix = resolve(appDir) + "\0";
  for (const key of cache.getCache("turboPlanCache").keys()) {
    if (key.startsWith(prefix)) cache.removeFromCache("turboPlanCache", key);
  }
}

function turboCacheKey(appDir: string, method: string, pathname: string): string {
  return `${resolve(appDir)}\0${method}\0${pathname}`;
}

function isHelloWorld(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== "object") return false;
  if (Array.isArray(obj)) return false;
  const o = obj as { hello?: unknown };
  if (o.hello !== "world") return false;
  // Fast check: ensure there is exactly one own enumerable key (`hello`).
  let count = 0;
  const hasOwn = Object.prototype.hasOwnProperty;
  // eslint-disable-next-line guard-for-in
  for (const k in o) {
    if (!hasOwn.call(o, k)) continue;
    count += 1;
    if (count > 1) return false;
  }
  return count === 1;
}

function sendFrameworkResponse(
  res: ServerResponse,
  response: Response,
  extraStatus?: number,
  extraHeaders?: Record<string, string | number>,
  responseSchema?: ResponseSchemaMap,
  /** When set, use this for JSON body instead of serializing (avoids double serialize). */
  preSerializedJson?: string,
) {
  const status = response.status ?? extraStatus ?? 200;
  res.statusCode = status;

  if (extraHeaders) {
    // Avoid Object.entries allocation in the hot path.
    for (const k in extraHeaders) res.setHeader(k, String(extraHeaders[k]!));
  }
  const headers = response.headers;
  if (headers) {
    // Avoid Object.entries allocation in the hot path.
    for (const k in headers) res.setHeader(k, headers[k]!);
  }

  if ("json" in response) {
    // Avoid res.getHeader() allocation/lookup work when not needed.
    if (!res.hasHeader("content-type"))
      res.setHeader("content-type", "application/json; charset=utf-8");
    if (status === 200 && isHelloWorld(response.json)) {
      res.end(HELLO_WORLD_JSON);
      return;
    }
    const stringifier = getStringifier(responseSchema, status);
    let payload: string;
    if (preSerializedJson) {
      payload = preSerializedJson;
    } else if (stringifier) {
      try {
        payload = stringifier(response.json);
      } catch {
        payload = JSON.stringify(response.json);
      }
    } else {
      payload = JSON.stringify(response.json);
    }
    res.end(payload);
    return;
  }

  const body = (response as { body?: string | Uint8Array }).body ?? "";
  res.end(typeof body === "string" ? body : Buffer.from(body));
}

export async function handleNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: RequestHandlerOptions = {},
) {
  const appDir = options.appDir ?? "./src";
  const compiledOptions = getCompiledRequestOptions(options);
  const rawMethod = req.method ?? "GET";
  const method =
    rawMethod === "GET" ||
    rawMethod === "POST" ||
    rawMethod === "PUT" ||
    rawMethod === "PATCH" ||
    rawMethod === "DELETE" ||
    rawMethod === "HEAD" ||
    rawMethod === "OPTIONS"
      ? rawMethod
      : rawMethod.toUpperCase();
  const rawUrl = req.url ?? "/";
  const q = rawUrl.indexOf("?");
  const pathnameRaw = q === -1 ? rawUrl : rawUrl.slice(0, q);
  const pathname = pathnameRaw.startsWith("/")
    ? pathnameRaw
    : "/" + pathnameRaw;

  const runtimeOrPromise = getOrCreateRuntime(options);
  const runtime =
    typeof (runtimeOrPromise as Promise<Runtime>).then === "function"
      ? ((await runtimeOrPromise) as Runtime)
      : (runtimeOrPromise as Runtime);
  const tracingEnabled = runtime.tracing === true;
  const ctx = runtime.createRequestContext(req, res);
  const handleRequest = async () => {
  let matchedRouteId: string | null = null;
  let pathnameForMiddleware = pathname;
  let middleware: Middleware[] = [];
  let route: ResolvedRoute | null = null;
  let pipeline: ((ctx: ReionContext) => unknown | Promise<unknown>) | null = null;
  let skipBodyParsing = false;

  const turboKey = turboCacheKey(appDir, method, pathname);
  const cachedPlan = cache.getFromCache("turboPlanCache", turboKey) as TurboPlan | undefined;
  if (cachedPlan) {
    skipBodyParsing = cachedPlan.rawBody === true;
    matchedRouteId = cachedPlan.routeId;
    pathnameForMiddleware = cachedPlan.middlewarePath;
    middleware = cachedPlan.middleware;
    pipeline = cachedPlan.pipeline;
    if (ctx.__responseSchemaRef && cachedPlan.mergedResponseSchema !== undefined)
      ctx.__responseSchemaRef.current = cachedPlan.mergedResponseSchema;
    if (ctx.__defaultStatusRef) ctx.__defaultStatusRef.current = cachedPlan.defaultStatus;
  } else if (method !== "GET" && method !== "HEAD") {
    const preRoute = await resolveRoute(method, pathname, appDir);
    if (preRoute?.route?.rawBody === true) skipBodyParsing = true;
    route = preRoute as ResolvedRoute | null;
  }

  let effectiveSecurity = COMPILED_SECURITY_EMPTY;
  if (hasAnySecurityFiles(appDir)) {
    const routeSecurity = await resolveRouteSecurityConfig(appDir, pathname, method);
    if (routeSecurity !== undefined) effectiveSecurity = compileSecurity(routeSecurity);
  }
  if (!applySecurityGuards(effectiveSecurity, ctx, method)) return;

  if (method === "GET" || method === "HEAD") {
    ctx.body = null;
  } else if (skipBodyParsing) {
    // Keep raw stream intact for route handlers that need direct access (e.g. Better Auth).
    ctx.body = null;
  } else {
    const maxBodySize = effectiveSecurity.requestSize.enabled
      ? effectiveSecurity.requestSize.maxBodySize
      : (options.maxBodySize ?? 1_000_000);
    const parseResult = await parseBody(req, maxBodySize);
    if (!parseResult.ok) {
      res.statusCode = parseResult.status;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(parseResult.body));
      return;
    }
    ctx.body = parseResult.body;
  }

  if (runtime.hasPlugins) await runtime.runHook("onRequest", ctx);

  if (compiledOptions.cors.enabled) {
    if (shouldRejectCompiledCorsRequest(compiledOptions.cors, req)) {
      const rawOrigin = req.headers.origin;
      const requestOrigin =
        typeof rawOrigin === "string"
          ? rawOrigin
          : Array.isArray(rawOrigin)
            ? (rawOrigin[0] ?? "unknown")
            : "unknown";
      res.statusCode = 403;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: `CORS policy violation: origin "${requestOrigin}" is not allowed.`,
          code: "CORS_ORIGIN_NOT_ALLOWED",
          hint: "Add this origin to `cors.origin`",
        }),
      );
      return;
    }
    const corsHeaders = applyCompiledCorsHeaders(compiledOptions.cors, req);
    for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
  }

  ctx.__traceSpan?.start({ method, pathname });

  if (!pipeline) {
    if (!route) {
      const routeResult = resolveRoute(method, pathname, appDir);
      route = (
        routeResult != null &&
        typeof (routeResult as Promise<unknown>).then === "function"
          ? await routeResult
          : routeResult
      ) as ResolvedRoute | null;
    }
    matchedRouteId =
      route != null
        ? (route.route?.routeId ??
          (route as { routeId?: string }).routeId ??
          null)
        : null;

    if (route) {
      ctx.params = route.params;
      const loaded = route.route;
      const mergedResponseSchema = loaded.responseSchema
        ? { ...(options.responses ?? {}), ...loaded.responseSchema }
        : options.responses;
      const defaultStatus = mergedResponseSchema !== undefined ? getDefaultStatusFromSchema(mergedResponseSchema) : 200;
      if (ctx.__responseSchemaRef && mergedResponseSchema !== undefined)
        ctx.__responseSchemaRef.current = mergedResponseSchema;
      if (ctx.__defaultStatusRef) ctx.__defaultStatusRef.current = defaultStatus;
      if (runtime.hasPlugins) await runtime.runHook("onRouteMatch", ctx);
      pathnameForMiddleware = route.middlewarePath;
      const middlewareResolver = getOrCreateMiddlewareResolver(appDir);
      const middlewareResult = middlewareResolver.resolveForPathname(
        pathnameForMiddleware,
        method,
      );
      middleware = (
        middlewareResult != null &&
        typeof (middlewareResult as Promise<unknown>).then === "function"
          ? await middlewareResult
          : middlewareResult
      ) as Middleware[];
      if (runtime.hasPlugins) {
        await runtime.runHook("onMiddlewareResolved", ctx, {
          pathname: pathnameForMiddleware,
          method,
          count: middleware.length,
        });
      }
      pipeline = getOrCreatePipeline(
        appDir,
        pathnameForMiddleware,
        method,
        route.route,
        middleware,
      );
      cache.setInCache("turboPlanCache", turboKey, {
        middlewarePath: pathnameForMiddleware,
        route: route.route,
        middleware,
        rawBody: route.route.rawBody === true,
        mergedResponseSchema,
        defaultStatus,
        pipeline,
        routeId: matchedRouteId,
      });
    }
  }

  let requestError: unknown;
  try {
    let handlerResult: unknown;

    if (runtime.hasPlugins) await runtime.runHook("beforeHandler", ctx);
    if (pipeline) {
      const raw = pipeline(ctx);
      handlerResult =
        raw != null && typeof (raw as Promise<unknown>).then === "function"
          ? await raw
          : raw;
    } else {
      handlerResult = {
        status: 404,
        json: { error: NOT_FOUND_MSG, method, pathname },
      };
    }
    if (runtime.hasPlugins)
      await runtime.runHook("afterHandler", ctx, handlerResult);
    if (ctx.res.sent) {
      // User already sent via ctx.res.json(), ctx.res.send(), etc.
    } else {
      if (!ctx.res.sent) {
        if (runtime.hasPlugins)
          await runtime.runHook("beforeResponse", ctx);
        const response = toFrameworkResponse(handlerResult);
        const mergedResponseSchema =
          route && ctx.__responseSchemaRef?.current !== undefined
            ? ctx.__responseSchemaRef.current
            : options.responses;
        const statusCode = ctx.res.statusCode ?? 200;
        let preSerializedJson: string | undefined;
        if ("json" in response) {
          if (statusCode === 200 && isHelloWorld(response.json)) {
            if (tracingEnabled && ctx.__responseSizeRef)
              ctx.__responseSizeRef.current = HELLO_WORLD_JSON.length;
          } else if (tracingEnabled) {
            const stringifier = getStringifier(
              mergedResponseSchema,
              statusCode,
            );
            if (stringifier) {
              try {
                preSerializedJson = stringifier(response.json);
              } catch {
                preSerializedJson = JSON.stringify(response.json);
              }
            } else {
              preSerializedJson = JSON.stringify(response.json);
            }
            if (ctx.__responseSizeRef && preSerializedJson)
              ctx.__responseSizeRef.current =
                Buffer.byteLength(preSerializedJson);
          }
        } else if (tracingEnabled && ctx.__responseSizeRef && "body" in response) {
          const b = (response as { body?: string | Uint8Array }).body;
          ctx.__responseSizeRef.current =
            b === undefined
              ? 0
              : typeof b === "string"
                ? Buffer.byteLength(b)
                : b.length;
        }
        sendFrameworkResponse(
          res,
          response,
          ctx.res.statusCode,
          ctx.res.headers,
          mergedResponseSchema,
          preSerializedJson,
        );
      }
    }
  } catch (err) {
    requestError = err;
    if (err instanceof ValidationError) {
      if (!ctx.res.sent) {
        res.statusCode = err.status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(err.json));
      }
      return;
    }
    const actualErr = err instanceof NextError ? err.error : err;
    if (runtime.hasPlugins)
      await runtime.runHook("onError", ctx, actualErr).catch(() => {});
    const errorHandler = options.errorHandler ?? defaultErrorHandler;
    try {
      if (!ctx.res.sent && runtime.hasPlugins)
        await runtime.runHook("beforeResponse", ctx);
      const result = await errorHandler(ctx, actualErr);
      if (!ctx.res.sent && result != null && typeof result === "object") {
        const status = "status" in result ? (result as any).status : 500;
        const headers =
          "headers" in result ? (result as any).headers : undefined;
        if ("json" in result) {
          res.statusCode = status ?? 500;
          if (headers)
            for (const [k, v] of Object.entries(headers))
              res.setHeader(k, String(v));
          if (!res.getHeader("content-type"))
            res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify((result as any).json));
        } else if ("body" in result) {
          res.statusCode = status ?? 500;
          if (headers)
            for (const [k, v] of Object.entries(headers))
              res.setHeader(k, String(v));
          const body = (result as any).body ?? "";
          res.end(typeof body === "string" ? body : Buffer.from(body));
        }
      }
    } catch (handlerErr) {
      if (!ctx.res.sent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(INTERNAL_ERROR_JSON);
      }
      appLogger.error(handlerErr);
    }
  } finally {
    const span = ctx.__traceSpan;
    if (tracingEnabled && span) {
      span.annotate("statusCode", res.statusCode);
      span.annotate("routeId", matchedRouteId);
      span.annotate("responseSize", ctx.__responseSizeRef?.current ?? 0);
      if (requestError !== undefined) {
        const actualErr =
          requestError instanceof NextError ? requestError.error : requestError;
        span.annotate(
          "error",
          actualErr instanceof Error ? actualErr.message : String(actualErr),
        );
      }
      span.end();
    }
    if (runtime.hasPlugins) await runtime.runHook("afterResponse", ctx);
    if (runtime.contextPool) releaseContext(ctx);
  }
  };

  await handleRequest();
}
