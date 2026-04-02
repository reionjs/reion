import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReionContext } from "../core/context.js";

export type RateLimitConfig = {
  enabled?: boolean;
  windowMs?: number;
  max?: number;
  keyBy?: "ip" | ((ctx: ReionContext) => string);
  message?: string;
};

export type SecurityHeadersConfig = {
  enabled?: boolean;
  contentSecurityPolicy?: string | false;
  frameguard?: "DENY" | "SAMEORIGIN" | false;
  referrerPolicy?: string | false;
  hsts?: string | false;
  xssProtection?: string | false;
};

export type RequestSizeConfig = {
  enabled?: boolean;
  maxBodySize?: number;
};

export type IpFilterConfig = {
  enabled?: boolean;
  allow?: string[];
  deny?: string[];
  trustProxy?: boolean;
};

export type CsrfConfig = {
  enabled?: boolean;
  cookieName?: string;
  headerName?: string;
  methods?: string[];
  message?: string;
};

export type TimeoutConfig = {
  enabled?: boolean;
  timeoutMs?: number;
  message?: string;
};

export type SecurityConfig = {
  rateLimit?: RateLimitConfig;
  headers?: SecurityHeadersConfig;
  requestSize?: RequestSizeConfig;
  ipFilter?: IpFilterConfig;
  csrf?: CsrfConfig;
  timeout?: TimeoutConfig;
};

export type CompiledRateLimit = {
  enabled: boolean;
  windowMs: number;
  max: number;
  keyBy: "ip" | ((ctx: ReionContext) => string);
  message: string;
};

export type CompiledHeaders = {
  enabled: boolean;
  headers: Record<string, string>;
};

export type CompiledRequestSize = {
  enabled: boolean;
  maxBodySize: number;
};

export type CompiledIpFilter = {
  enabled: boolean;
  allow: string[];
  deny: string[];
  trustProxy: boolean;
};

export type CompiledCsrf = {
  enabled: boolean;
  cookieName: string;
  headerName: string;
  methods: Set<string>;
  message: string;
};

export type CompiledTimeout = {
  enabled: boolean;
  timeoutMs: number;
  message: string;
};

export type CompiledSecurity = {
  rateLimit: CompiledRateLimit;
  headers: CompiledHeaders;
  requestSize: CompiledRequestSize;
  ipFilter: CompiledIpFilter;
  csrf: CompiledCsrf;
  timeout: CompiledTimeout;
};

export type SecurityGuardArgs = {
  req: IncomingMessage;
  res: ServerResponse;
  ctx: ReionContext;
  method: string;
};

export type SecurityGuardResult = {
  ok: boolean;
  status?: number;
  json?: unknown;
};

