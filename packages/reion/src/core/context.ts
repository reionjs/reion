import type { IncomingMessage, ServerResponse } from "node:http";
import type { Readable } from "node:stream";

import type { TraceSpan } from "../trace/traceEngine.js";
import type {
  RequestLogEntry,
  ReionLogger,
} from "../logger/requestLogger.js";

/** Exposed on ctx.trace so the user can get the request trace id (e.g. for logging). */
export type TraceRef = { readonly traceId: string };
import { getNoopLogger } from "../logger/requestLogger.js";
import type { EventEmitterFn } from "../events/eventBus.js";
import type { ResponseSchemaMap } from "../validation/routeSchema.js";

export type Response =
  | {
      status?: number;
      headers?: Record<string, string>;
      body?: string | Uint8Array;
    }
  | {
      status?: number;
      headers?: Record<string, string>;
      json: unknown;
    };

/** Chainable return type for ctx.res.status(code).json() / .send() / .text() / .html() */
export type ResStatusChain = {
  json: (data: unknown) => void | Promise<void>;
  send: (body: string | Buffer | Uint8Array) => void | Promise<void>;
  text: (body: string) => void | Promise<void>;
  html: (body: string) => void | Promise<void>;
};

/** Fluent response API on ctx.res */
export type ReionResponse = {
  /** Raw Node HTTP response */
  raw: ServerResponse;
  /** Set status code; returns chainable .json() / .send() / .text() */
  status: (code: number) => ResStatusChain;
  /** Current status code (e.g. set by status()); used when handler returns data without calling res.json() */
  readonly statusCode: number;
  /** Headers to send (merged when response is sent) */
  headers: Record<string, string | number>;
  /** Set a single header */
  setHeader: (name: string, value: string | number) => void;
  /** Send raw body (HTML, buffer). Default content-type not set; use setHeader for HTML */
  send: (body: string | Buffer | Uint8Array) => void | Promise<void>;
  /** Send HTML (content-type text/html) */
  html: (body: string) => void | Promise<void>;
  /** Send JSON (content-type application/json) */
  json: (data: unknown) => void | Promise<void>;
  /** Send plain text (content-type text/plain) */
  text: (body: string) => void | Promise<void>;
  /** Redirect to url (default 302). Use status as second arg for 301 etc. */
  redirect: (url: string, status?: number) => void | Promise<void>;
  /** Pipe a readable stream as the response body */
  stream: (readable: Readable) => void | Promise<void>;
  /** True if response was already sent (e.g. via res.json()) */
  readonly sent: boolean;
  /** @internal Reuse for another request when using context pool. */
  reinit?: (
    nodeRes: ServerResponse,
    defaultStatusRef: DefaultStatusRef,
    responseSizeRef?: { current: number },
  ) => void;
};

export interface ReionContext {
  req: IncomingMessage;
  res: ReionResponse;
  /** Path params; catch-all [[...x]] params are string[], others are string. */
  params: Record<string, string | string[]>;
  /** Query params (parsed from URL or replaced by validated Record after validation). */
  query: Record<string, string>;
  body: unknown;
  state: Record<string, unknown>;
  emit: EventEmitterFn;
  /** Request-scoped logger with traceId in bindings. Use for application logs; tracing is automatic. */
  logger: ReionLogger;
  /** Request-scoped captured logger output for plugin/readback use. */
  log: { state: RequestLogEntry[] };
  /** Request trace id (one per request). Use ctx.trace.traceId for correlation. */
  trace: TraceRef;
  /** @internal Used by framework for span start/annotate/end; do not use. */
  __traceSpan?: TraceSpan;
  /** @internal Set by framework so res.json() can validate against response schema for current status. */
  __responseSchemaRef?: ResponseSchemaRef;
  /** @internal Set by framework from merged response schema (route + config) so res uses that default when status() not called. */
  __defaultStatusRef?: DefaultStatusRef;
  /** @internal Set by framework when response is sent; used for trace responseSize. */
  __responseSizeRef?: { current: number };
  /** @internal Backing for query getter; reset on release for context pool. */
  __queryCache?: Record<string, string> | undefined;
  /** @internal Ref for beforeSend to resolve ctx when res sends. */
  __ctxRef?: { current: ReionContext | null };
}

/** Map status codes to response body types for typed res.status(code).json(data). */
export type ResponseBodyByStatus = Record<number, unknown>;

/** Chain with json(data) typed by status code. */
export type ResStatusChainTyped<T> = {
  json: (data: T) => void;
  send: (body: string | Buffer | Uint8Array) => void;
  text: (body: string) => void;
  html: (body: string) => void;
};

/** Response API: status(code) accepts any number; .json(data) typed for codes in T when possible. */
export type ReionResponseTyped<T extends ResponseBodyByStatus> = Omit<
  ReionResponse,
  "status" | "json"
> & {
  /** Accepts any status code; .json() payload is typed when code is in your response schema. */
  status: (code: number) => ResStatusChainTyped<unknown>;
  json: (data: unknown) => void;
};

/** Context with res.json() typed by status from response schema. */
export type ContextWithResponses<T extends ResponseBodyByStatus> = Omit<
  ReionContext,
  "res"
> & {
  res: ReionResponseTyped<T>;
};

/**
 * Context type. Use without a generic for untyped res, or with a response body type map to enforce schema typing.
 * @example
 * export default async function GET(ctx: Context) { ... }
 * // Or with response schema typing:
 * type Res = InferResponseBodies<typeof RESPONSE_SCHEMA>;
 * export default async function GET(ctx: Context<Res>) { ctx.res.status(200).json([...]); }
 */
export type Context<T extends ResponseBodyByStatus = never> = [T] extends [
  never,
]
  ? Omit<
      ReionContext,
      | "__traceSpan"
      | "__responseSchemaRef"
      | "__defaultStatusRef"
      | "__responseSizeRef"
      | "__ctxRef"
      | "__queryCache"
    >
  : Omit<
      ContextWithResponses<T>,
      | "__traceSpan"
      | "__responseSchemaRef"
      | "__defaultStatusRef"
      | "__responseSizeRef"
      | "__ctxRef"
      | "__queryCache"
    >;

export type ResponseSchemaRef = { current?: ResponseSchemaMap };

export type DefaultStatusRef = { current: number };

/** Pick default status when handler does not call res.status(): prefer 200, then 201, then 204; else 200. */
export function getDefaultStatusFromSchema(
  schema: ResponseSchemaMap | undefined,
): number {
  if (!schema || typeof schema !== "object") return 200;
  const keys = Object.keys(schema)
    .map(Number)
    .filter((k) => !Number.isNaN(k)) as number[];
  if (keys.length === 0) return 200;
  if (keys.includes(200)) return 200;
  if (keys.includes(201)) return 201;
  if (keys.includes(204)) return 204;
  return 200;
}

/** Mutable state for a single response; reused when context is pooled (Fastify-style). */
type ResponseState = {
  nodeRes: ServerResponse;
  defaultStatusRef: DefaultStatusRef;
  responseSizeRef: { current: number } | undefined;
  sent: boolean;
  explicitStatus: number | null;
  headers: Record<string, string | number>;
};

export type BeforeSendFn = (ctx: ReionContext) => void | Promise<void>;

function createReionResponse(
  nodeRes: ServerResponse,
  defaultStatusRef: DefaultStatusRef,
  responseSizeRef?: { current: number },
  beforeSend?: BeforeSendFn,
  ctxRef?: { current: ReionContext | null },
): ReionResponse {
  const state: ResponseState = {
    nodeRes,
    defaultStatusRef,
    responseSizeRef,
    sent: false,
    explicitStatus: null,
    headers: Object.create(null) as Record<string, string | number>,
  };

  function effectiveStatus(): number {
    return state.explicitStatus ?? state.defaultStatusRef.current;
  }

  function isRawClosed(): boolean {
    return state.nodeRes.writableEnded || state.nodeRes.destroyed;
  }

  function applyHeaders(): void {
    for (const [k, v] of Object.entries(state.headers)) {
      state.nodeRes.setHeader(k, String(v));
    }
  }

  function doSend(body?: string | Buffer | Uint8Array): void {
    if (isRawClosed()) {
      state.sent = true;
      return;
    }
    state.sent = true;
    if (state.responseSizeRef) {
      state.responseSizeRef.current =
        body === undefined
          ? 0
          : Buffer.isBuffer(body)
            ? body.length
            : typeof body === "string"
              ? Buffer.byteLength(body)
              : body.length;
    }
    state.nodeRes.statusCode = effectiveStatus();
    applyHeaders();
    if (body !== undefined) {
      state.nodeRes.end(
        Buffer.isBuffer(body)
          ? body
          : typeof body === "string"
            ? body
            : Buffer.from(body),
      );
    } else {
      state.nodeRes.end();
    }
  }

  function end(body?: string | Buffer | Uint8Array): void | Promise<void> {
    if (state.sent || isRawClosed()) {
      state.sent = true;
      return;
    }
    if (beforeSend && ctxRef?.current) {
      const c = ctxRef;
      return (async () => {
        await beforeSend(c.current!);
        if (state.sent || isRawClosed()) {
          state.sent = true;
          return;
        }
        doSend(body);
      })();
    }
    doSend(body);
  }

  function sendJson(data: unknown): void | Promise<void> {
    if (state.sent || isRawClosed()) {
      state.sent = true;
      return;
    }
    state.nodeRes.setHeader("content-type", "application/json; charset=utf-8");
    return end(JSON.stringify(data));
  }

  const chain: ResStatusChain = {
    json(data: unknown) {
      return sendJson(data);
    },
    send(body: string | Buffer | Uint8Array) {
      return end(body);
    },
    text(body: string) {
      if (state.sent || isRawClosed()) {
        state.sent = true;
        return;
      }
      state.nodeRes.setHeader("content-type", "text/plain; charset=utf-8");
      return end(body);
    },
    html(body: string) {
      if (state.sent || isRawClosed()) {
        state.sent = true;
        return;
      }
      state.nodeRes.setHeader("content-type", "text/html; charset=utf-8");
      return end(body);
    },
  };

  function doRedirect(url: string, code: number): void {
    if (isRawClosed()) {
      state.sent = true;
      return;
    }
    state.explicitStatus = code;
    if (state.responseSizeRef) state.responseSizeRef.current = 0;
    state.nodeRes.setHeader("location", url);
    applyHeaders();
    state.sent = true;
    state.nodeRes.statusCode = effectiveStatus();
    state.nodeRes.end();
  }

  function redirect(url: string, code = 302): void | Promise<void> {
    if (state.sent || isRawClosed()) {
      state.sent = true;
      return;
    }
    if (beforeSend && ctxRef?.current) {
      const c = ctxRef;
      return (async () => {
        await beforeSend(c.current!);
        if (state.sent || isRawClosed()) {
          state.sent = true;
          return;
        }
        doRedirect(url, code);
      })();
    }
    doRedirect(url, code);
  }

  function doStream(readable: Readable): void {
    if (isRawClosed()) {
      state.sent = true;
      return;
    }
    state.sent = true;
    if (state.responseSizeRef) state.responseSizeRef.current = 0;
    state.nodeRes.statusCode = effectiveStatus();
    applyHeaders();
    readable.pipe(state.nodeRes);
  }

  function stream(readable: Readable): void | Promise<void> {
    if (state.sent || isRawClosed()) {
      state.sent = true;
      return;
    }
    if (beforeSend && ctxRef?.current) {
      const c = ctxRef;
      return (async () => {
        await beforeSend(c.current!);
        if (state.sent || isRawClosed()) {
          state.sent = true;
          return;
        }
        doStream(readable);
      })();
    }
    doStream(readable);
  }

  const res: ReionResponse = {
    get raw() {
      return state.nodeRes;
    },
    status(code: number) {
      state.explicitStatus = code;
      return chain;
    },
    get headers() {
      return state.headers;
    },
    setHeader(name: string, value: string | number) {
      if (isRawClosed() || state.nodeRes.headersSent) {
        state.sent = true;
        return;
      }
      state.headers[name.toLowerCase()] = value;
    },
    send(body: string | Buffer | Uint8Array) {
      return end(body);
    },
    html(body: string) {
      if (state.sent || isRawClosed()) {
        state.sent = true;
        return;
      }
      state.nodeRes.setHeader("content-type", "text/html; charset=utf-8");
      return end(body);
    },
    json(data: unknown) {
      return sendJson(data);
    },
    text(body: string) {
      if (state.sent || isRawClosed()) {
        state.sent = true;
        return;
      }
      state.nodeRes.setHeader("content-type", "text/plain; charset=utf-8");
      return end(body);
    },
    redirect,
    stream,
    get sent() {
      return state.sent || isRawClosed();
    },
    get statusCode() {
      return effectiveStatus();
    },
    reinit(n: ServerResponse, d: DefaultStatusRef, r?: { current: number }) {
      state.nodeRes = n;
      state.defaultStatusRef = d;
      state.responseSizeRef = r;
      state.sent = false;
      state.explicitStatus = null;
      for (const k of Object.keys(state.headers)) delete state.headers[k];
    },
  };

  return res;
}

const ctxPool: ReionContext[] = [];
const EMPTY_PARAMS = Object.create(null) as Record<string, string | string[]>;

/** Parse query string to a plain object (no URLSearchParams allocation; null prototype). */
function parseQuery(search: string): Record<string, string> {
  const obj = Object.create(null) as Record<string, string>;
  if (!search.length) return obj;
  let start = 0;
  while (start < search.length) {
    const eq = search.indexOf("=", start);
    const amp = search.indexOf("&", start);
    const end = amp === -1 ? search.length : amp;
    const keyRaw = search.slice(start, eq === -1 ? end : eq);
    const key = keyRaw.includes("+")
      ? decodeURIComponent(keyRaw.replaceAll("+", " "))
      : keyRaw.includes("%")
        ? decodeURIComponent(keyRaw)
        : keyRaw;
    const value =
      eq === -1 || eq >= end
        ? ""
        : (() => {
            const rawValue = search.slice(eq + 1, end);
            if (rawValue.includes("+"))
              return decodeURIComponent(rawValue.replaceAll("+", " "));
            if (rawValue.includes("%")) return decodeURIComponent(rawValue);
            return rawValue;
          })();
    if (key.length) obj[key] = value;
    start = amp === -1 ? search.length : amp + 1;
  }
  return obj;
}

function parseQueryFromReq(req: IncomingMessage): Record<string, string> {
  const raw = req.url ?? "/";
  const i = raw.indexOf("?");
  const search = i === -1 ? "" : raw.slice(i + 1);
  return parseQuery(search);
}

function allocContext(
  req: IncomingMessage,
  res: ServerResponse,
  beforeSend?: BeforeSendFn,
): ReionContext {
  const responseSchemaRef: ResponseSchemaRef = {};
  const defaultStatusRef: DefaultStatusRef = { current: 200 };
  const responseSizeRef: { current: number } = { current: 0 };
  const ctxRef: { current: ReionContext | null } = { current: null };

  const ctx: ReionContext = {
    req,
    res: createReionResponse(
      res,
      defaultStatusRef,
      responseSizeRef,
      beforeSend,
      ctxRef,
    ),
    __responseSchemaRef: responseSchemaRef,
    __defaultStatusRef: defaultStatusRef,
    __responseSizeRef: responseSizeRef,
    params: Object.create(null) as Record<string, string | string[]>,
    get query() {
      if (ctx.__queryCache === undefined) {
        ctx.__queryCache = parseQueryFromReq(ctx.req);
      }
      return ctx.__queryCache;
    },
    set query(v: Record<string, string>) {
      ctx.__queryCache = v;
    },
    body: null,
    state: Object.create(null) as Record<string, unknown>,
    emit: () => {},
    logger: getNoopLogger(),
    log: { state: [] },
    trace: {
      get traceId() {
        return "";
      },
    },
    __ctxRef: ctxRef,
  };
  ctxRef.current = ctx;
  return ctx;
}

function reinitContext(
  ctx: ReionContext,
  req: IncomingMessage,
  res: ServerResponse,
  beforeSend?: BeforeSendFn,
): ReionContext {
  const defaultStatusRef = ctx.__defaultStatusRef!;
  const responseSizeRef = ctx.__responseSizeRef!;
  defaultStatusRef.current = 200;
  responseSizeRef.current = 0;
  ctx.req = req;
  if (ctx.__ctxRef) ctx.__ctxRef.current = ctx;
  if (ctx.res.reinit) {
    ctx.res.reinit(res, defaultStatusRef, responseSizeRef);
  } else {
    const ctxRef = ctx.__ctxRef ?? { current: ctx };
    ctx.res = createReionResponse(
      res,
      defaultStatusRef,
      responseSizeRef,
      beforeSend,
      ctxRef,
    );
  }
  ctx.params = Object.create(null) as Record<string, string | string[]>;
  ctx.body = null;
  delete (ctx as { __queryCache?: unknown }).__queryCache;
  ctx.state = Object.create(null) as Record<string, unknown>;
  ctx.log.state = [];
  return ctx;
}

/** Get context from pool or create new. Use releaseContext(ctx) in finally when done. When usePool is false, always alloc (faster hot path for hello-world). */
export function getContext(
  req: IncomingMessage,
  res: ServerResponse,
  usePool = false,
  beforeSend?: BeforeSendFn,
): ReionContext {
  if (!usePool) return allocContext(req, res, beforeSend);
  const recycled = ctxPool.pop();
  if (recycled) return reinitContext(recycled, req, res, beforeSend);
  return allocContext(req, res, beforeSend);
}

/** Return context to pool. Call in request handler finally. Keeps ctx.res for reuse via reinit. */
export function releaseContext(ctx: ReionContext): void {
  (ctx as { req: IncomingMessage }).req = null!;
  ctx.params = EMPTY_PARAMS;
  ctx.body = null;
  delete (ctx as { __queryCache?: unknown }).__queryCache;
  ctx.state = Object.create(null) as Record<string, unknown>;
  ctx.log.state = [];
  ctxPool.push(ctx);
}

/** Get a request context (from pool when possible). Same as getContext; exported for backwards compatibility. */
export const createContext = getContext;
