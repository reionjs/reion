import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ReionContext } from "../core/context.js";
import type { ReionPlugin } from "../plugin/pluginAPI.js";
import type { ResponseSchemaMap } from "../validation/routeSchema.js";
import type { ReionLogger } from "../logger/requestLogger.js";
import type { TracerFn, TraceStartFn } from "../trace/traceEngine.js";
import { existsSync } from "node:fs";
import { appLogger } from "../utils/logger.js";

export type CorsConfig = {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
};

export type ErrorHandlerResult =
  | { status?: number; headers?: Record<string, string>; json?: unknown }
  | { status?: number; headers?: Record<string, string>; body?: string | Uint8Array };

export type ErrorHandler = (
  ctx: ReionContext,
  err: unknown
) => void | ErrorHandlerResult | Promise<void | ErrorHandlerResult>;

export type ReionConfig = {
  appDir?: string;
  buildPath?: string;
  /** Port for dev/start (CLI --port overrides). */
  port?: number;
  /** Dev-only options. */
  dev?: {
    /** Set true to use pino-pretty for human-readable logs in development. */
    logPretty?: boolean;
  };
  maxBodySize?: number;
  errorHandler?: ErrorHandler;
  cors?: CorsConfig;
  plugins?: ReionPlugin[];
  /** Default response body schemas per status code. Enforced before send; invalid response becomes 500. */
  responses?: ResponseSchemaMap;
  /** Base logger for request loggers (ctx.logger). If not set, a default pino logger is used. */
  logger?: ReionLogger;
  /** Set false to disable request lifecycle logging (request started / request completed) and tracer/traceStart callbacks (default: true). */
  tracing?: boolean;
  /** Called when a request span ends with trace data (method, pathname, duration, status, responseSize, etc.). */
  tracer?: TracerFn;
  /** Called when a request span starts. Default logs "request started" via logger. */
  traceStart?: TraceStartFn;
  /**
   * Path prefixes for which request tracing is skipped: no default "request started" /
   * "request completed" logs, no custom tracer/traceStart, and no ctx.log mirroring.
   * Example: `["/reion-devtools", "/.well-known"]` to silence devtools UI and Chrome probes.
   */
  tracingIgnorePathPrefixes?: string[];
};

export async function loadConfig(cwd: string): Promise<ReionConfig> {
  const candidates = ["reion.config.ts", "reion.config.js", "reion.config.mjs"];
  for (const name of candidates) {
    const configPath = resolve(cwd, name);
    try {
      if (name.endsWith(".ts")) {
        try {
          // @ts-expect-error - tsx/esm has no types; registers loader for .ts
          await import("tsx/esm");
        } catch {
          continue;
        }
      }
      const url = pathToFileURL(configPath).href;
      const mod = await import(url);
      const config = mod.default ?? mod;
      return typeof config === "object" && config !== null ? config : {};
    } catch(error) {
      continue;
    }
  }
  return {};
}

export function getAppDir(config: ReionConfig, cwd: string): string | undefined {
  // Default app directory layout:
  // - routes live under `${appDir}/router/**`
  // - other runtime features (events/middleware/etc.) use `${appDir}`
  try {
    const raw = config.appDir ?? "./src";
    const routerDir = raw.startsWith("/") ? raw : resolve(cwd, raw);
    if (existsSync(routerDir)) {
      return routerDir;
    }
    throw new Error();
  } catch {
    appLogger.error("App directory not found: ", config.appDir);
    return;
  }
}

export function getBuildPath(config: ReionConfig, cwd: string): string {
  const raw = config.buildPath ?? "./dist";
  return raw.startsWith("/") ? raw : resolve(cwd, raw);
}

export type RequestHandlerOptionsFromConfig = {
  appDir: string;
  maxBodySize?: number;
  errorHandler?: ErrorHandler;
  cors?: CorsConfig;
  plugins?: ReionPlugin[];
  responses?: ResponseSchemaMap;
  logger?: ReionLogger;
  dev?: { logPretty?: boolean };
  tracing?: boolean;
  tracer?: TracerFn;
  traceStart?: TraceStartFn;
  tracingIgnorePathPrefixes?: string[];
};

export function getRequestHandlerOptionsFromConfig(
  config: ReionConfig,
  cwd: string,
  overrides?: { appDir?: string }
): RequestHandlerOptionsFromConfig {
  const appDir = overrides?.appDir ?? getAppDir(config, cwd);
  const out: RequestHandlerOptionsFromConfig = { appDir: appDir||"" };
  if (config.maxBodySize !== undefined) out.maxBodySize = config.maxBodySize;
  if (config.errorHandler !== undefined) out.errorHandler = config.errorHandler;
  if (config.cors !== undefined) out.cors = config.cors;
  if (config.plugins !== undefined) out.plugins = config.plugins;
  if (config.responses !== undefined) out.responses = config.responses;
  if (config.logger !== undefined) out.logger = config.logger;
  if (config.dev !== undefined) out.dev = config.dev;
  if (config.tracing !== undefined) out.tracing = config.tracing;
  if (config.tracer !== undefined) out.tracer = config.tracer;
  if (config.traceStart !== undefined) out.traceStart = config.traceStart;
  if (config.tracingIgnorePathPrefixes !== undefined)
    out.tracingIgnorePathPrefixes = config.tracingIgnorePathPrefixes;
  return out;
}
