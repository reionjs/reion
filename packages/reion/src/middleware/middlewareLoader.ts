import { pathToFileURL } from "node:url";
import { invalidateModuleCache } from "../loader/moduleCache.js";
import type { Middleware } from "./middlewareRunner.js";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function toMiddlewareArray(raw: unknown): Middleware[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((fn: unknown): fn is Middleware => typeof fn === "function");
}

export async function loadMiddlewareFromFile(
  filePath: string,
  method: string
): Promise<Middleware[]> {
  try {
    const bust = process.env.REION_MIDDLEWARE_RELOAD_TOKEN;
    if (bust) invalidateModuleCache(filePath);
    const url = pathToFileURL(filePath).href;
    const importUrl = bust ? `${url}?t=${bust}` : url;
    const mod = await import(importUrl);
    const all = toMiddlewareArray(mod.default);
    const methodKey = `${method}_middleware`;
    if (METHODS.includes(method) && mod[methodKey] != null) {
      all.push(...toMiddlewareArray(mod[methodKey]));
    }
    return all;
  } catch {
    return [];
  }
}
