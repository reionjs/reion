import { compileCsrf } from "./csrf.js";
import { compileHeaders } from "./headers.js";
import { compileIpFilter } from "./ipFilter.js";
import { compileRateLimit } from "./rateLimit.js";
import { compileTimeout } from "./timeout.js";
import type { CompiledRequestSize, CompiledSecurity, SecurityConfig } from "./types.js";

function compileRequestSize(config: SecurityConfig | undefined): CompiledRequestSize {
  const enabled = config?.requestSize?.enabled === true;
  return {
    enabled,
    maxBodySize: Math.max(1_024, config?.requestSize?.maxBodySize ?? 1_000_000),
  };
}

export function compileSecurity(config?: SecurityConfig): CompiledSecurity {
  return {
    rateLimit: compileRateLimit(config?.rateLimit),
    headers: compileHeaders(config?.headers),
    requestSize: compileRequestSize(config),
    ipFilter: compileIpFilter(config?.ipFilter),
    csrf: compileCsrf(config?.csrf),
    timeout: compileTimeout(config?.timeout),
  };
}

/** Reused when a route has no security config (avoids allocating a new object every request). */
export const COMPILED_SECURITY_EMPTY: CompiledSecurity = compileSecurity(undefined);

