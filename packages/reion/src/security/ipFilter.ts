import type { IncomingMessage } from "node:http";
import type { CompiledIpFilter, IpFilterConfig } from "./types.js";

export function compileIpFilter(config?: IpFilterConfig): CompiledIpFilter {
  return {
    enabled: config?.enabled === true,
    allow: config?.allow ?? [],
    deny: config?.deny ?? [],
    trustProxy: config?.trustProxy === true,
  };
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((x) => Number.parseInt(x, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0;
}

function cidrMatch(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  if (!range || !bitsRaw) return false;
  const bits = Number.parseInt(bitsRaw, 10);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function patternMatch(ip: string, pattern: string): boolean {
  if (pattern.includes("/")) return cidrMatch(ip, pattern);
  return ip === pattern;
}

export function getRequestIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function isIpAllowed(config: CompiledIpFilter, ip: string): boolean {
  if (!config.enabled) return true;
  for (const deny of config.deny) {
    if (patternMatch(ip, deny)) return false;
  }
  if (config.allow.length === 0) return true;
  for (const allow of config.allow) {
    if (patternMatch(ip, allow)) return true;
  }
  return false;
}

