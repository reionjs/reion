import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const _require = createRequire(import.meta.url);

/** Invalidate Node/Bun module cache for a file so the next import() loads fresh (dev hot reload). */
export function invalidateModuleCache(filePath: string): void {
  if (!_require.cache) return;
  const url = pathToFileURL(filePath).href;
  const resolved = resolve(filePath);
  const keys = new Set<string>([url, resolved]);
  for (const key of Object.keys(_require.cache)) {
    if (key === resolved || key.endsWith(filePath) || key.endsWith(resolved)) keys.add(key);
  }
  for (const k of keys) delete _require.cache[k];
}
