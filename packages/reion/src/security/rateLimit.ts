import type { ReionContext } from "../core/context.js";
import type { CompiledRateLimit, RateLimitConfig } from "./types.js";

type RateEntry = { count: number; resetAt: number };

const buckets = new Map<string, RateEntry>();

export function compileRateLimit(config?: RateLimitConfig): CompiledRateLimit {
  return {
    enabled: config?.enabled === true,
    windowMs: Math.max(1_000, config?.windowMs ?? 60_000),
    max: Math.max(1, config?.max ?? 100),
    keyBy: config?.keyBy ?? "ip",
    message: config?.message ?? "Too many requests",
  };
}

export function resolveClientIp(ctx: ReionContext): string {
  const xff = ctx.req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return ctx.req.socket.remoteAddress ?? "unknown";
}

export function checkRateLimit(
  config: CompiledRateLimit,
  ctx: ReionContext,
): { ok: boolean; retryAfterSec?: number; remaining?: number; limit?: number } {
  if (!config.enabled) return { ok: true };
  const identityKey =
    config.keyBy === "ip"
      ? `ip:${resolveClientIp(ctx)}`
      : `custom:${config.keyBy(ctx)}`;
  // Include policy fingerprint so route-level overrides don't reuse global counters.
  const policyKey = `w:${config.windowMs}|m:${config.max}|msg:${config.message}`;
  const rawUrl = ctx.req.url ?? "/";
  const q = rawUrl.indexOf("?");
  const pathname = q === -1 ? rawUrl : rawUrl.slice(0, q);
  // Route-aware key so one endpoint does not consume another endpoint's quota.
  const routeKey = `p:${pathname || "/"}`;
  const key = `${identityKey}|${policyKey}|${routeKey}`;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true, remaining: config.max - 1, limit: config.max };
  }
  existing.count += 1;
  if (existing.count > config.max) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, retryAfterSec, remaining: 0, limit: config.max };
  }
  return {
    ok: true,
    remaining: Math.max(0, config.max - existing.count),
    limit: config.max,
  };
}

