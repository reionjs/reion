import type { ServerResponse } from "node:http";
import type { CompiledTimeout, TimeoutConfig } from "./types.js";

export function compileTimeout(config?: TimeoutConfig): CompiledTimeout {
  return {
    enabled: config?.enabled === true,
    timeoutMs: Math.max(100, config?.timeoutMs ?? 30_000),
    message: config?.message ?? "Request timeout",
  };
}

export function applyTimeout(
  res: ServerResponse,
  config: CompiledTimeout,
): void {
  if (!config.enabled) return;
  const sendTimeout = () => {
    if (res.writableEnded) return;
    res.statusCode = 408;
    if (!res.getHeader("content-type")) {
      res.setHeader("content-type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify({ error: config.message }));
  };

  // Node: res.setTimeout works. Bun: it may not reliably fire, so we also keep a JS timer.
  try {
    res.setTimeout(config.timeoutMs, sendTimeout);
  } catch {
    // ignore
  }

  const t = setTimeout(sendTimeout, config.timeoutMs);
  const clear = () => clearTimeout(t);
  res.once("finish", clear);
  res.once("close", clear);
}

