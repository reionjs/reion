import type { ReionContext } from "../core/context.js";
import type { RouteSchema, ResponseSchemaMap } from "../validation/routeSchema.js";

export type ReionCommandName = "dev" | "build" | "start";

export type ReionCommandHookContext = {
  command: ReionCommandName;
  cwd: string;
  appDir?: string;
  host?: string;
  port?: number;
  buildPath?: string;
  reason?: string;
  filename?: string;
  changedPath?: string;
  fileExists?: boolean;
  fileType?: "route" | "middleware" | "security" | "event" | "plugin" | "other";
  name?: string;
  source?: "manual" | "scheduler";
  payload?: unknown;
  error?: unknown;
};

/** One route (pathname + HTTP method) with validation/response schemas from the loaded route module. */
export type InitRouteEntry = {
  pathname: string;
  filePath: string;
  method: string;
  schema?: RouteSchema;
  methodSchema?: RouteSchema;
  responseSchema?: ResponseSchemaMap;
};

/** Full app manifest passed to `init` once when the runtime is created. */
export type ReionInitContext = {
  appDir: string;
  routes: InitRouteEntry[];
  events: Array<{ name: string; filePath: string }>;
  middlewares: Array<{ pathPrefix: string; filePath: string }>;
};

export type ReionPlugin = {
  name: string;
  /** Runs once after routes, middleware, pipelines, and events are loaded. */
  init?: (ctx: ReionInitContext) => void | Promise<void>;
  onRequest?: (ctx: ReionContext) => void | Promise<void>;
  onRouteMatch?: (ctx: ReionContext) => void | Promise<void>;
  onMiddlewareResolved?: (
    ctx: ReionContext,
    info: { pathname: string; method: string; count: number }
  ) => void | Promise<void>;
  onEventEmit?: (
    ctx: ReionContext,
    info: { name: string; payload?: unknown }
  ) => void | Promise<void>;
  beforeHandler?: (ctx: ReionContext) => void | Promise<void>;
  afterHandler?: (ctx: ReionContext, result: unknown) => void | Promise<void>;
  /** Runs before any response is sent (headers can still be set). */
  beforeResponse?: (ctx: ReionContext) => void | Promise<void>;
  /** Runs after the response has been sent (in finally block). */
  afterResponse?: (ctx: ReionContext) => void | Promise<void>;
  onError?: (ctx: ReionContext, error: unknown) => void | Promise<void>;
  onDevStart?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onDevFileChange?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onDevRestart?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onDevStop?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onBuildStart?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onBuildComplete?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onBuildError?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onStartStart?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onStartListening?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onStartStop?: (ctx: ReionCommandHookContext) => void | Promise<void>;
  onStartError?: (ctx: ReionCommandHookContext) => void | Promise<void>;
};

