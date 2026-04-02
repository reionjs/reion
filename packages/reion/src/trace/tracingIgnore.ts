/**
 * Returns true if pathname should be excluded from tracing (default + user tracers
 * and ctx.log mirroring). Prefixes are normalized to start with `/`.
 */
export function shouldIgnoreTracingPathname(
  pathname: string,
  prefixes: string[] | undefined,
): boolean {
  if (!prefixes?.length) return false;
  const p = pathname.startsWith("/") ? pathname : "/" + pathname;
  for (const raw of prefixes) {
    const pre = normalizePrefix(raw);
    if (!pre || pre === "/") continue;
    if (p === pre || p.startsWith(pre + "/")) return true;
  }
  return false;
}

function normalizePrefix(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("/") ? t : "/" + t;
}
