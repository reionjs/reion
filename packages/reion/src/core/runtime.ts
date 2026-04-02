import type { IncomingMessage, ServerResponse } from "node:http";

import { getContext, type ReionContext } from "./context.js";
import { createTraceSpan } from "../trace/traceEngine.js";
import { createRequestLogger } from "../logger/requestLogger.js";
import { createEventBus } from "../events/eventBus.js";
import type { EventBus, EventEmitSource } from "../events/eventBus.js";
import { createPluginManager } from "../plugin/pluginManager.js";
import type { ReionPlugin } from "../plugin/pluginAPI.js";
import type { TracerFn, TraceData, TraceStartFn, TraceStartData } from "../trace/traceEngine.js";
import { shouldIgnoreTracingPathname } from "../trace/tracingIgnore.js";

export type RuntimeOptions = {
  appDir?: string | undefined;
  plugins?: ReionPlugin[];
  eventBus?: EventBus;
  tracer?: TracerFn;
  traceStart?: TraceStartFn;
  /** When false, disable tracer/traceStart callbacks (default: true). Logger always has traceId for correlation. */
  tracing?: boolean;
  /** When true, reuse context objects from a pool (can reduce GC; enable for long-lived servers with many routes). */
  contextPool?: boolean;
  /** Skip tracer/traceStart + ctx.log mirroring for matching path prefixes. */
  tracingIgnorePathPrefixes?: string[];
};

export function createRuntime(options: RuntimeOptions = {}) {
  const events = options.eventBus ?? createEventBus();
  const plugins = options.plugins ?? [];
  const pluginManager = createPluginManager(plugins);
  const useTracing =
    options.tracing !== false &&
    process.env.REION_SKIP_TRACING !== "1" &&
    process.env.REION_SKIP_TRACING !== "true";
  const tracer = useTracing ? options.tracer : undefined;
  const traceStart = useTracing ? options.traceStart : undefined;
  const hasPlugins = plugins.length > 0;
  const contextPool = options.contextPool === true;
  const tracingIgnore = options.tracingIgnorePathPrefixes;

  function createRequestContext(req: IncomingMessage, res: ServerResponse) {
    const beforeSend = hasPlugins
      ? (ctx: ReionContext) => pluginManager.runHook("beforeResponse", ctx)
      : undefined;
    const ctx = getContext(req, res, contextPool, beforeSend);
    const requestTraceStart: TraceStartFn | undefined =
      traceStart
        ? (data: TraceStartData) => {
            if (shouldIgnoreTracingPathname(data.pathname, tracingIgnore)) return;
            traceStart(data);
            ctx.log.state.push({
              level: "info",
              args: [{ method: data.method, pathname: data.pathname }, "request started"],
              timestamp: data.startTime
            });
          }
        : undefined;
    const requestTracer: TracerFn | undefined =
      tracer
        ? (data: TraceData) => {
            if (shouldIgnoreTracingPathname(data.pathname, tracingIgnore)) return;
            tracer(data);
            ctx.log.state.push({
              level: "info",
              args: [
                {
                  method: data.method,
                  pathname: data.pathname,
                  ...(data.statusCode != null && { statusCode: data.statusCode }),
                  durationMs: data.durationMs,
                  ...(data.routeId != null && { routeId: data.routeId }),
                  ...(data.responseSize != null && { responseSize: data.responseSize }),
                  ...(data.error != null && { error: data.error })
                },
                "request completed"
              ],
              timestamp: data.endTime
            });
          }
        : undefined;
    const span = createTraceSpan(requestTracer, requestTraceStart);
    ctx.log.state = [];
    const sink = useTracing || hasPlugins ? ctx.log.state : undefined;
    ctx.logger = createRequestLogger(span.traceId, undefined, sink);
    ctx.trace = { get traceId() { return span.traceId; } };
    ctx.__traceSpan = span;
    ctx.emit = (name, payload) => {
      if (hasPlugins) {
        void pluginManager.runHook("onEventEmit", ctx, { name, payload });
      }
      const source: EventEmitSource = {
        traceId: span.traceId,
        logger: ctx.logger,
        eventName: name,
      };
      events.emit(name, payload, source);
    };
    return ctx;
  }

  return {
    createRequestContext,
    events,
    hasPlugins,
    contextPool,
    tracing: useTracing,
    runHook: pluginManager.runHook.bind(pluginManager)
  };
}

export type Runtime = ReturnType<typeof createRuntime>;

