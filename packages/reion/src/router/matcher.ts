import type { ScannedRoute } from "../loader/fileScanner.js";

export type MatchResult = {
  routeId: string;
  /** Method -> file path. "" = route.ts (all methods). GET, POST, etc. = get.ts, post.ts. */
  fileByMethod: Record<string, string>;
  /** Catch-all [[...x]] params are string[], others are string. */
  params: Record<string, string | string[]>;
};

export function matchRoute(
  method: string,
  pathname: string,
  routes: ScannedRoute[]
): MatchResult | null {
  const urlSegments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);

  for (const route of routes) {
    const patternSegments = route.pathname.replace(/^\/+/, "").split("/").filter(Boolean);

    const params: Record<string, string> = {};
    let i = 0;
    let j = 0;
    let match = true;

    while (i < patternSegments.length && j < urlSegments.length) {
      const rawSeg = patternSegments[i];
      if (rawSeg === undefined) {
        match = false;
        break;
      }
      const seg = rawSeg;

      // Route groups: (main) – ignore in URL structure
      if (seg.startsWith("(") && seg.endsWith(")")) {
        i += 1;
        continue;
      }

      const urlSeg = urlSegments[j] ?? "";

      // Optional catch-all: [[...all]]
      const catchAllMatch = seg.match(/^\[\[\.\.\.(.+)\]\]$/);
      if (catchAllMatch) {
        const name = catchAllMatch[1] as string;
        params[name] = decodeURIComponent(urlSegments.slice(j).join("/"));
        // catch-all must be the last pattern segment
        i = patternSegments.length;
        j = urlSegments.length;
        break;
      }

      // Dynamic segment: [id]
      const dynMatch = seg.match(/^\[(.+)\]$/);
      if (dynMatch) {
        const name = dynMatch[1] as string;
        params[name] = decodeURIComponent(urlSeg);
        i += 1;
        j += 1;
        continue;
      }

      // Static segment
      if (seg !== urlSeg) {
        match = false;
        break;
      }

      i += 1;
      j += 1;
    }

    // Skip remaining route groups at the end
    while (i < patternSegments.length) {
      const seg = patternSegments[i];
      if (!seg || !(seg.startsWith("(") && seg.endsWith(")"))) break;
      i += 1;
    }

    const hasExtraUrlSegments = j < urlSegments.length;
    const hasUnmatchedPatternSegments = i < patternSegments.length;

    if (!match || hasExtraUrlSegments || hasUnmatchedPatternSegments) continue;

    const fileByMethod = route.method ? { [route.method]: route.filePath } : { "": route.filePath };
    return {
      routeId: route.pathname,
      fileByMethod,
      params
    };
  }

  return null;
}
