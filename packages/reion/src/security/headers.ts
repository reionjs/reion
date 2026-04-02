import type { CompiledHeaders, SecurityHeadersConfig } from "./types.js";

export function compileHeaders(config?: SecurityHeadersConfig): CompiledHeaders {
  const enabled = config?.enabled !== false;
  const out: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-xss-protection": "1; mode=block",
    "permissions-policy": "geolocation=(), microphone=(), camera=()",
  };
  const csp = config?.contentSecurityPolicy;
  if (csp !== false) {
    out["content-security-policy"] =
      typeof csp === "string"
        ? csp
        : "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; object-src 'none'";
  }
  const frameguard = config?.frameguard;
  if (frameguard === false) delete out["x-frame-options"];
  else if (typeof frameguard === "string") out["x-frame-options"] = frameguard;
  const referrer = config?.referrerPolicy;
  if (referrer === false) delete out["referrer-policy"];
  else if (typeof referrer === "string") out["referrer-policy"] = referrer;
  const hsts = config?.hsts;
  if (hsts !== false) {
    out["strict-transport-security"] =
      typeof hsts === "string" ? hsts : "max-age=15552000; includeSubDomains";
  }
  const xss = config?.xssProtection;
  if (xss === false) delete out["x-xss-protection"];
  else if (typeof xss === "string") out["x-xss-protection"] = xss;
  return { enabled, headers: out };
}

export function applySecurityHeaders(
  headers: Record<string, string>,
  setHeader: (name: string, value: string) => void,
): void {
  for (const [k, v] of Object.entries(headers)) setHeader(k, v);
}

