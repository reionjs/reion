import { randomUUID } from "node:crypto";

/** Data passed when a request span starts. Log as [datetime][traceId] method pathname. */
export type TraceStartData = {
  traceId: string;
  method: string;
  pathname: string;
  startTime: number;
};

/** Data recorded for one request span. Passed to the tracer callback on span end. */
export type TraceData = {
  /** Unique id for this request. One per request; use to correlate logs and tracer output. */
  traceId: string;
  /** HTTP method (e.g. GET, POST). */
  method: string;
  /** Request pathname. */
  pathname: string;
  /** Resolved route id (e.g. /api/users) or undefined if no route matched. */
  routeId?: string;
  /** Response status code. */
  statusCode?: number;
  /** Response body size in bytes (when sent via ctx.res or return). */
  responseSize?: number;
  /** Span duration in milliseconds. */
  durationMs: number;
  /** Start time epoch millis. */
  startTime: number;
  /** End time epoch millis. */
  endTime: number;
  /** Optional error message when handler threw. */
  error?: string;
  /** Custom annotations (set internally by framework from request lifecycle). */
  annotations: Record<string, unknown>;
};

export type TracerFn = (data: TraceData) => void;
export type TraceStartFn = (data: TraceStartData) => void;

export type TraceSpan = {
  /** Unique id for this request. One per request; use in logs and response headers. */
  readonly traceId: string;
  start: (meta?: Record<string, unknown>) => void;
  annotate: (key: string, value: unknown) => void;
  end: () => void;
};

/** Shared no-op span when tracing is disabled; avoids per-request allocation and UUID. */
export const NOOP_TRACE: TraceSpan = {
  get traceId() {
    return "";
  },
  start: () => {},
  annotate: () => {},
  end: () => {}
};

export function createTraceSpan(tracer?: TracerFn, traceStart?: TraceStartFn): TraceSpan {
  if (tracer === undefined && traceStart === undefined) return NOOP_TRACE;
  const traceId = randomUUID();
  let startTime: number | null = null;
  const annotations: Record<string, unknown> = {};
  let initialMeta: Record<string, unknown> = {};

  return {
    get traceId() {
      return traceId;
    },

    start(meta?: Record<string, unknown>) {
      startTime = Date.now();
      initialMeta = meta ?? {};
      const method = (meta?.method as string) ?? "GET";
      const pathname = (meta?.pathname as string) ?? "";
      traceStart?.({
        traceId,
        method,
        pathname,
        startTime,
      });
    },

    annotate(key: string, value: unknown) {
      annotations[key] = value;
    },

    end() {
      const endTime = Date.now();
      const start = startTime ?? endTime;
      const durationMs = endTime - start;

      const routeId = annotations.routeId as string | undefined;
      const statusCode = annotations.statusCode as number | undefined;
      const error = annotations.error as string | undefined;
      const responseSize = annotations.responseSize as number | undefined;

      const data: TraceData = {
        traceId,
        ...initialMeta,
        method: (initialMeta.method as string) ?? "GET",
        pathname: (initialMeta.pathname as string) ?? "",
        durationMs,
        startTime: start,
        endTime,
        annotations: { ...annotations },
        ...(routeId !== undefined && routeId !== null && { routeId }),
        ...(statusCode !== undefined && statusCode !== null && { statusCode }),
        ...(responseSize !== undefined && responseSize !== null && { responseSize }),
        ...(error !== undefined && error !== null && { error }),
      };

      tracer?.(data);
    },
  };
}
