import { pathToFileURL } from "node:url";
import { invalidateModuleCache } from "../loader/moduleCache.js";
import type {
  RouteSchema,
  ResponseSchemaMap,
} from "../validation/routeSchema.js";
import { addRouteFileToTable, getRouteTable, removeRouteFileFromTable } from "./routeTable.js";
import { resolve } from "node:path";
import { clearPipelineForRoute } from "../pipeline/pipelineCache.js";
import { reloadRoute } from "./router.js";
import { appLogger } from "../utils/logger.js";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export type RouteHandler = (ctx: unknown) => unknown | Promise<unknown>;

/**
 * Load a route file (e.g. route.ts) and return which HTTP methods it actually exports
 * (named export GET/POST/... or default that is a function).
 */
export async function getMethodsExportedByRouteFile(
  filePath: string,
): Promise<string[]> {
  try {
    const url = pathToFileURL(filePath).href;
    const bust = process.env.REION_RELOAD_TOKEN;
    if (bust) invalidateModuleCache(filePath);
    const importUrl = bust ? `${url}?t=${bust}` : url;
    const mod = await import(importUrl);
    const methods: string[] = [];
    for (const method of HTTP_METHODS) {
      const fn = mod[method] ?? mod.default;
      if (typeof fn === "function") methods.push(method);
    }
    return methods;
  } catch {
    return [];
  }
}

export type LoadedRoute = {
  routeId: string;
  handler: RouteHandler;
  schema?: RouteSchema;
  methodSchema?: RouteSchema;
  responseSchema?: ResponseSchemaMap;
  /** Skip framework body parsing for this route and pass raw req stream to handler. */
  rawBody?: boolean;
};

export async function loadRoute(
  filePath: string,
  method: string,
  routeId: string,
): Promise<LoadedRoute | null> {
  try {
    const url = pathToFileURL(filePath).href;
    const bust = process.env.REION_RELOAD_TOKEN;
    if (bust) invalidateModuleCache(filePath);
    const importUrl = bust ? `${url}?t=${bust}` : url;
    const mod = await import(importUrl);
    const handlerFn = mod[method] ?? mod.default;
    if (typeof handlerFn !== "function") return null;
    return {
      routeId,
      handler: handlerFn as RouteHandler,
      ...(mod.SCHEMA != null && { schema: mod.SCHEMA as RouteSchema }),
      ...(mod[`${method}_SCHEMA`] != null && {
        methodSchema: mod[`${method}_SCHEMA`] as RouteSchema,
      }),
      ...((mod[`${method}_RESPONSE_SCHEMA`] ?? mod.RESPONSE_SCHEMA) != null && {
        responseSchema: (mod[`${method}_RESPONSE_SCHEMA`] ??
          mod.RESPONSE_SCHEMA) as ResponseSchemaMap,
      }),
      ...((mod[`${method}_RAW_BODY`] ?? mod.RAW_BODY) === true && { rawBody: true }),
    };
  } catch (err) {
    appLogger.error("[reion] loadRoute error:", err);
    return null;
  }
}

export async function reloadRoutes({
  currentDir,
  changedPath,
  fileExists,
  filename,
}: {
  currentDir: string;
  changedPath: string;
  fileExists: boolean;
  filename: string;
}): Promise<void> {
  const table = getRouteTable(currentDir);
  const routeEntries = table.filter(
    (r) => resolve(r.filePath) === resolve(changedPath),
  );
  for (const r of routeEntries)
    clearPipelineForRoute(currentDir, r.pathname, r.method ?? "");
  const label = routeEntries
    .map((r) => `${r.method || "*"} ${r.pathname}`)
    .join(", ");
  if (!fileExists && routeEntries.length > 0) {
    removeRouteFileFromTable(currentDir, changedPath);
    appLogger.info(`[reion] delete route: ${label} (${filename})`);
    return;
  } else if (routeEntries.length > 0) {
    const token = String(Date.now());
    process.env.REION_RELOAD_TOKEN = token;
    await reloadRoute(currentDir, changedPath);
    appLogger.info(`[reion] reload: ${label} (${filename})`);
    return;
  }

  addRouteFileToTable(currentDir, changedPath);
  appLogger.info(`[reion] add route: ${label} (${filename})`);
  return;
}
