import pino, { type Logger } from "pino";
import pinoPretty from "pino-pretty";

/** Request-scoped logger with traceId in bindings. Use ctx.logger in handlers; tracing is automatic. */
export type ReionLogger = Logger;
export type RequestLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type RequestLogEntry = {
  level: RequestLogLevel;
  args: unknown[];
  timestamp: string | number;
};

let defaultLogger: Logger | null = null;

/** Base logger used to create request-scoped children. Override via setBaseLogger. */
export function getBaseLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = pino({
      level: process.env.LOG_LEVEL ?? "info"
    });
  }
  return defaultLogger;
}

/** Create a pino logger with pino-pretty for human-readable dev output (e.g. when dev.logPretty is true). */
export function createPrettyLogger(): Logger {
  const stream = pinoPretty({
    colorize: true,
    translateTime: "SYS:HH:MM:ss"
  });
  return pino(
    { level: process.env.LOG_LEVEL ?? "info" },
    stream
  );
}

/** Set a custom base logger (e.g. from reion.config). Request loggers will be children of this. */
export function setBaseLogger(logger: Logger): void {
  defaultLogger = logger;
}

/** Create a request-scoped logger with traceId so all logs correlate with the same request/trace. */
export function createRequestLogger(traceId: string, base?: Logger, sink?: RequestLogEntry[]): ReionLogger {
  const baseLogger = base ?? getBaseLogger();
  if (!traceId && !sink) return baseLogger;
  const requestLogger = baseLogger.child(traceId ? { traceId } : {});
  if (!sink) return requestLogger;
  return wrapLoggerWithSink(requestLogger, sink);
}

/** No-op logger for context placeholder before runtime assigns request logger. */
export function getNoopLogger(): ReionLogger {
  return pino({ level: "silent" });
}

function wrapLoggerWithSink(logger: ReionLogger, sink: RequestLogEntry[]): ReionLogger {
  const base = logger as unknown as Record<string, (...args: unknown[]) => unknown>;
  const wrapped = Object.create(logger) as ReionLogger;
  const push = (level: RequestLogLevel, args: unknown[]) => {
    sink.push({
      level,
      args,
      timestamp: new Date().toISOString()
    });
  };

  wrapped.trace = (...args: unknown[]) => {
    push("trace", args);
    return base.trace?.(...args);
  };
  wrapped.debug = (...args: unknown[]) => {
    push("debug", args);
    return base.debug?.(...args);
  };
  wrapped.info = (...args: unknown[]) => {
    push("info", args);
    return base.info?.(...args);
  };
  wrapped.warn = (...args: unknown[]) => {
    push("warn", args);
    return base.warn?.(...args);
  };
  wrapped.error = (...args: unknown[]) => {
    push("error", args);
    return base.error?.(...args);
  };
  wrapped.fatal = (...args: unknown[]) => {
    push("fatal", args);
    return base.fatal?.(...args);
  };
  wrapped.child = ((bindings: object, options?: unknown) => {
    const child = (base.child?.(bindings, options) as ReionLogger) ?? logger.child(bindings);
    return wrapLoggerWithSink(child, sink);
  }) as unknown as ReionLogger["child"];
  return wrapped;
}
