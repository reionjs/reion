import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROUTE_FILES = ["route.ts", "route.js", "route.mts", "route.mjs"];

const METHOD_FILE_NAMES = ["get", "post", "put", "patch", "delete", "head", "options"];
const METHOD_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];
const METHOD_FILES = new Set<string>();
const METHOD_ROUTE_FILES = new Set<string>(); // get.route.ts, post.route.js, etc.
for (const name of METHOD_FILE_NAMES) {
  for (const ext of METHOD_EXTENSIONS) {
    METHOD_FILES.add(name + ext);
    METHOD_ROUTE_FILES.add(name + ".route" + ext);
  }
}

const MIDDLEWARE_FILES = ["middleware.ts", "middleware.js", "middleware.mts", "middleware.mjs"];

export type ScannedRoute = {
  pathname: string;
  filePath: string;
  /** Set for method-specific files (get.ts, get.route.ts, post.ts, etc.). Empty for route.ts (handles all methods). */
  method?: string;
};

function methodFromFilename(name: string): string | undefined {
  for (const m of METHOD_FILE_NAMES) {
    if (METHOD_FILES.has(name) && name.startsWith(m)) return m.toUpperCase();
    if (METHOD_ROUTE_FILES.has(name) && name.startsWith(m + ".route")) return m.toUpperCase();
  }
  return undefined;
}

export type ScannedMiddleware = {
  pathPrefix: string;
  filePath: string;
};

export function scanAppFiles(appDir: string): ScannedRoute[] {
  const base = resolve(appDir);
  const routes: ScannedRoute[] = [];

  function walk(dir: string, segments: string[]) {
    let entries: { name: string; isFile?: boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isFile: e.isFile()
      }));
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const seg = [...segments, entry.name];

      if (entry.isFile) {
        if (ROUTE_FILES.includes(entry.name)) {
          const pathname = "/" + segments.join("/");
          const formattedPathname = pathname.replace(/\/\([^/]+\)/g, "");
          routes.push({ pathname:formattedPathname, filePath: fullPath });
        } else if (METHOD_FILES.has(entry.name) || METHOD_ROUTE_FILES.has(entry.name)) {
          const pathname = "/" + segments.join("/");
          const formattedPathname = pathname.replace(/\/\([^/]+\)/g, "");
          const method = methodFromFilename(entry.name);
          if (method) routes.push({ pathname:formattedPathname, filePath: fullPath, method });
        }
      } else {
        walk(fullPath, seg);
      }
    }
  }

  walk(base, []);
  return routes;
}

/**
 * Scan only the given directory for route files (no nested subdirs).
 * pathname is computed relative to appDir so it matches the route path.
 */
export function scanRouteFilesInDir(appDir: string, dir: string): ScannedRoute[] {
  const base = resolve(appDir);
  const targetDir = resolve(dir);
  const routes: ScannedRoute[] = [];
  const pathPrefix = "/" + relative(base, targetDir).replace(/\\/g, "/").replace(/^\.\/?/, "").replace(/\/$/, "") || "";

  let entries: { name: string; isFile?: boolean }[];
  try {
    entries = readdirSync(targetDir, { withFileTypes: true }).map((e) => ({
      name: e.name,
      isFile: e.isFile()
    }));
  } catch {
    return routes;
  }

  for (const entry of entries) {
    if (!entry.isFile) continue;
    const fullPath = join(targetDir, entry.name);
    if (ROUTE_FILES.includes(entry.name)) {
      const pathname = pathPrefix || "/";
      routes.push({ pathname, filePath: fullPath });
    } else if (METHOD_FILES.has(entry.name) || METHOD_ROUTE_FILES.has(entry.name)) {
      const method = methodFromFilename(entry.name);
      if (method) {
        const pathname = pathPrefix || "/";
        routes.push({ pathname, filePath: fullPath, method });
      }
    }
  }
  return routes;
}

export function scanMiddlewareFiles(appDir: string): ScannedMiddleware[] {
  // Middleware is colocated under the router tree only.
  // This keeps scanning consistent with route file discovery (`{appDir}/router/**`).
  const base = resolve(appDir, "router");
  const list: ScannedMiddleware[] = [];

  function walk(dir: string, segments: string[]) {
    let entries: { name: string; isFile?: boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isFile: e.isFile()
      }));
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const seg = [...segments, entry.name];

      if (entry.isFile) {
        if (MIDDLEWARE_FILES.includes(entry.name)) {
          const pathPrefix = segments.join("/");
          list.push({ pathPrefix, filePath: fullPath });
        }
      } else {
        walk(fullPath, seg);
      }
    }
  }

  walk(base, []);
  return list;
}
