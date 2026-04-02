import type { CompiledCsrf, CsrfConfig } from "./types.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function compileCsrf(config?: CsrfConfig): CompiledCsrf {
  const methods = new Set((config?.methods ?? ["POST", "PUT", "PATCH", "DELETE"]).map((m) => m.toUpperCase()));
  return {
    enabled: config?.enabled === true,
    cookieName: config?.cookieName ?? "csrf_token",
    headerName: (config?.headerName ?? "x-csrf-token").toLowerCase(),
    methods,
    message: config?.message ?? "Invalid CSRF token",
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  const parts = header.split(";");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function verifyCsrf(
  config: CompiledCsrf,
  method: string,
  headers: Record<string, string | string[] | undefined>,
): boolean {
  if (!config.enabled) return true;
  const upper = method.toUpperCase();
  if (SAFE_METHODS.has(upper) || !config.methods.has(upper)) return true;
  const rawCookie = headers.cookie;
  const cookieHeader = typeof rawCookie === "string" ? rawCookie : Array.isArray(rawCookie) ? rawCookie[0] : undefined;
  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies[config.cookieName];
  const rawHeaderToken = headers[config.headerName];
  const headerToken = typeof rawHeaderToken === "string" ? rawHeaderToken : Array.isArray(rawHeaderToken) ? rawHeaderToken[0] : undefined;
  return !!cookieToken && !!headerToken && cookieToken === headerToken;
}

