import type { IncomingMessage } from "node:http";
import type { CorsConfig } from "../config/loadConfig.js";

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"];
const DEFAULT_HEADERS = ["content-type", "authorization", "accept"];

function getRequestOrigin(req: IncomingMessage): string | null {
  const raw = req.headers.origin;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

function isOriginAllowed(config: CorsConfig, req: IncomingMessage): boolean {
  const origin = getRequestOrigin(req);

  /** Must not use `config.origin || []` — undefined would become [] and reject every Origin. */
  const cfg = config.origin;

  if (!origin) {
    // Non-browser or same-origin requests usually don't send Origin.
    return true;
  }
  if (cfg === undefined || cfg === true) {
    return true;
  }
  if (cfg === false) {
    return false;
  }
  if (typeof cfg === "string") {
    return cfg === origin;
  }
  if (Array.isArray(cfg)) {
    return cfg.includes(origin);
  }
  return false;
}

function resolveOrigin(config: CorsConfig, req: IncomingMessage): string | null {
  const origin = getRequestOrigin(req);
  if (!isOriginAllowed(config, req)) return null;

  const cfg = config.origin;
  if (cfg === undefined || cfg === true) {
    return origin;
  }
  if (cfg === false) {
    return null;
  }
  if (typeof cfg === "string") {
    return cfg;
  }
  if (Array.isArray(cfg)) {
    // Allowed when list contains request origin.
    return origin;
  }
  return null;
}

export function shouldRejectCorsRequest(cors: CorsConfig | boolean, req: IncomingMessage): boolean {
  const config: CorsConfig = typeof cors === "boolean" ? {} : cors;
  const origin = getRequestOrigin(req);
  if (!origin) return false;
  return !isOriginAllowed(config, req);
}

export function getCorsHeaders(
  cors: CorsConfig | boolean,
  req: IncomingMessage
): Record<string, string> {
  const config: CorsConfig = typeof cors === "boolean" ? {} : cors;
  const allowOrigin = resolveOrigin(config, req);
  if (!allowOrigin) return {};

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin
  };

  const methods = config.methods ?? DEFAULT_METHODS;
  headers["Access-Control-Allow-Methods"] = Array.isArray(methods) ? methods.join(", ") : methods;

  const allowedHeaders = config.allowedHeaders ?? DEFAULT_HEADERS;
  headers["Access-Control-Allow-Headers"] = Array.isArray(allowedHeaders)
    ? allowedHeaders.join(", ")
    : allowedHeaders;

  if (config.credentials === true) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export type CompiledCors =
  | { enabled: false }
  | {
      enabled: true;
      origin: CorsConfig["origin"];
      allowMethods: string;
      allowHeaders: string;
      credentials: boolean;
    };

export function compileCors(cors: CorsConfig | undefined): CompiledCors {
  if (!cors || Object.keys(cors).length === 0) return { enabled: false };
  const methods = cors.methods ?? DEFAULT_METHODS;
  const allowedHeaders = cors.allowedHeaders ?? DEFAULT_HEADERS;
  return {
    enabled: true,
    origin: cors.origin,
    allowMethods: Array.isArray(methods) ? methods.join(", ") : methods,
    allowHeaders: Array.isArray(allowedHeaders) ? allowedHeaders.join(", ") : allowedHeaders,
    credentials: cors.credentials === true
  };
}

function isCompiledOriginAllowed(originConfig: CorsConfig["origin"], requestOrigin: string | null): boolean {
  if (!requestOrigin) return true;
  if (originConfig === undefined || originConfig === true) return true;
  if (originConfig === false) return false;
  if (typeof originConfig === "string") return originConfig === requestOrigin;
  if (Array.isArray(originConfig)) return originConfig.includes(requestOrigin);
  return false;
}

function resolveCompiledOrigin(originConfig: CorsConfig["origin"], requestOrigin: string | null): string | null {
  if (!isCompiledOriginAllowed(originConfig, requestOrigin)) return null;
  if (originConfig === undefined || originConfig === true) return requestOrigin;
  if (originConfig === false) return null;
  if (typeof originConfig === "string") return originConfig;
  if (Array.isArray(originConfig)) return requestOrigin;
  return null;
}

export function applyCompiledCorsHeaders(compiled: CompiledCors, req: IncomingMessage): Record<string, string> {
  if (!compiled.enabled) return {};
  const requestOrigin = getRequestOrigin(req);
  const allowOrigin = resolveCompiledOrigin(compiled.origin, requestOrigin);
  if (!allowOrigin) return {};

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": compiled.allowMethods,
    "Access-Control-Allow-Headers": compiled.allowHeaders
  };
  if (compiled.credentials) headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}

export function shouldRejectCompiledCorsRequest(compiled: CompiledCors, req: IncomingMessage): boolean {
  if (!compiled.enabled) return false;
  const requestOrigin = getRequestOrigin(req);
  return !isCompiledOriginAllowed(compiled.origin, requestOrigin);
}
