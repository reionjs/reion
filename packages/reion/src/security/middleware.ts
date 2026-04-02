import type { ReionContext } from "../core/context.js";
import { verifyCsrf } from "./csrf.js";
import { applySecurityHeaders } from "./headers.js";
import { getRequestIp, isIpAllowed } from "./ipFilter.js";
import { checkRateLimit } from "./rateLimit.js";
import { applyTimeout } from "./timeout.js";
import type { CompiledSecurity } from "./types.js";

function reject(ctx: ReionContext, status: number, message: string): void {
  ctx.res.status(status).json({ error: message });
}

export function applySecurityGuards(
  compiled: CompiledSecurity,
  ctx: ReionContext,
  method: string,
): boolean {
  if (compiled.requestSize.enabled) {
    const raw = ctx.req.headers["content-length"];
    const contentLength =
      typeof raw === "string" ? Number.parseInt(raw, 10) : Array.isArray(raw) ? Number.parseInt(raw[0] ?? "", 10) : NaN;
    if (!Number.isNaN(contentLength) && contentLength > compiled.requestSize.maxBodySize) {
      reject(ctx, 413, "Payload too large");
      return false;
    }
  }
  if (compiled.headers.enabled) {
    applySecurityHeaders(compiled.headers.headers, (name, value) =>
      ctx.res.setHeader(name, value),
    );
  }
  if (compiled.timeout.enabled) {
    applyTimeout(ctx.res.raw, compiled.timeout);
  }
  if (compiled.ipFilter.enabled) {
    const ip = getRequestIp(ctx.req, compiled.ipFilter.trustProxy);
    if (!isIpAllowed(compiled.ipFilter, ip)) {
      reject(ctx, 403, "IP not allowed");
      return false;
    }
  }
  if (compiled.rateLimit.enabled) {
    const limit = checkRateLimit(compiled.rateLimit, ctx);
    if (!limit.ok) {
      if (limit.retryAfterSec) ctx.res.setHeader("retry-after", String(limit.retryAfterSec));
      if (limit.limit !== undefined) ctx.res.setHeader("x-ratelimit-limit", String(limit.limit));
      reject(ctx, 429, compiled.rateLimit.message);
      return false;
    }
    if (limit.limit !== undefined) ctx.res.setHeader("x-ratelimit-limit", String(limit.limit));
    if (limit.remaining !== undefined)
      ctx.res.setHeader("x-ratelimit-remaining", String(limit.remaining));
  }
  if (compiled.csrf.enabled) {
    if (!verifyCsrf(compiled.csrf, method, ctx.req.headers)) {
      reject(ctx, 403, compiled.csrf.message);
      return false;
    }
  }
  return true;
}

