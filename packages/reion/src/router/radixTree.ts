import type { ScannedRoute } from "../loader/fileScanner.js";
import type { MatchResult } from "./matcher.js";

/** Match result when using per-method tree (no fileByMethod lookup). Catch-all params are string[]. */
export type MatchResultPerMethod = {
  routeId: string;
  filePath: string;
  params: Record<string, string | string[]>;
};

/** Segment of a route pattern: static, dynamic [id], or catch-all [[...x]] */
type PatternSegment =
  | { type: "static"; value: string }
  | { type: "dynamic"; param: string }
  | { type: "catchAll"; param: string };

function parsePatternSegments(pathname: string): PatternSegment[] {
  const raw = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const out: PatternSegment[] = [];
  for (const seg of raw) {
    if (seg.startsWith("(") && seg.endsWith(")")) continue;
    const catchAll = seg.match(/^\[\[\.\.\.(.+)\]\]$/);
    if (catchAll) {
      out.push({ type: "catchAll", param: catchAll[1]! });
      break;
    }
    const dynamic = seg.match(/^\[(.+)\]$/);
    if (dynamic) {
      out.push({ type: "dynamic", param: dynamic[1]! });
      continue;
    }
    out.push({ type: "static", value: seg });
  }
  return out;
}

function tokenizePathname(pathname: string): string[] {
  const out: string[] = [];
  const len = pathname.length;
  let start = pathname.charCodeAt(0) === 47 ? 1 : 0;
  for (let i = start; i <= len; i++) {
    if (i === len || pathname.charCodeAt(i) === 47) {
      if (i > start) out.push(pathname.slice(start, i));
      start = i + 1;
    }
  }
  return out;
}

function decodeIfNeeded(value: string): string {
  return value.includes("%") ? decodeURIComponent(value) : value;
}

type RoutePayload = { routeId: string; fileByMethod: Record<string, string> };

type RadixNode = {
  route?: RoutePayload;
  static?: Map<string, RadixNode>;
  dynamic?: { param: string; node: RadixNode };
  catchAll?: { param: string; route: RoutePayload };
};

function createNode(): RadixNode {
  return {};
}

/** Insert a route into the tree. */
function insert(node: RadixNode, segments: PatternSegment[], payload: RoutePayload): void {
  let n = node;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.type === "catchAll") {
      n.catchAll = { param: seg.param, route: payload };
      return;
    }
    if (seg.type === "static") {
      if (!n.static) n.static = new Map();
      let next = n.static.get(seg.value);
      if (!next) {
        next = createNode();
        n.static.set(seg.value, next);
      }
      n = next;
      continue;
    }
    if (seg.type === "dynamic") {
      if (!n.dynamic) n.dynamic = { param: seg.param, node: createNode() };
      n = n.dynamic.node;
      continue;
    }
  }
  n.route = payload;
}

export type RadixTree = {
  match(pathname: string): MatchResult | null;
};

/**
 * Build a radix tree from scanned routes. Groups by pathname and merges method-specific files (get.ts, post.ts) with route.ts.
 */
export function buildRadixTree(routes: ScannedRoute[]): RadixTree {
  const byPath = new Map<string, Record<string, string>>();
  for (const r of routes) {
    const pathname = r.pathname;
    let fileByMethod = byPath.get(pathname);
    if (!fileByMethod) {
      fileByMethod = {};
      byPath.set(pathname, fileByMethod);
    }
    fileByMethod[r.method ?? ""] = r.filePath;
  }

  const root = createNode();
  for (const [pathname, fileByMethod] of byPath) {
    const segments = parsePatternSegments(pathname);
    const payload: RoutePayload = { routeId: pathname, fileByMethod };
    insert(root, segments, payload);
  }

  function match(pathname: string): MatchResult | null {
    const urlSegments = tokenizePathname(pathname);
    const params: Record<string, string | string[]> = {};

    function walk(n: RadixNode, segIndex: number): MatchResult | null {
      if (segIndex === urlSegments.length) {
        if (n.route) {
          const result: MatchResult = { routeId: n.route.routeId, fileByMethod: n.route.fileByMethod, params: { ...params } };
          return result;
        }
        return null;
      }

      const seg = urlSegments[segIndex] ?? "";

      if (n.static) {
        const next = n.static.get(seg);
        if (next) {
          const result = walk(next, segIndex + 1);
          if (result) return result;
        }
      }

      if (n.dynamic) {
        params[n.dynamic.param] = decodeIfNeeded(seg);
        const result = walk(n.dynamic.node, segIndex + 1);
        if (result) return result;
        delete params[n.dynamic.param];
      }

      if (n.catchAll) {
        params[n.catchAll.param] = urlSegments.slice(segIndex).map(decodeIfNeeded);
        const result: MatchResult = {
          routeId: n.catchAll.route.routeId,
          fileByMethod: n.catchAll.route.fileByMethod,
          params: { ...params }
        };
        return result;
      }

      return null;
    }

    return walk(root, 0);
  }

  return { match };
}

// --- Per-method tree (find-my-way style: one tree per HTTP method, direct filePath) ---

type PerMethodPayload = { routeId: string; filePath: string };

type RadixNodePerMethod = {
  route?: PerMethodPayload;
  static?: Map<string, RadixNodePerMethod>;
  dynamic?: { param: string; node: RadixNodePerMethod };
  catchAll?: { param: string; route: PerMethodPayload };
};

function createNodePerMethod(): RadixNodePerMethod {
  return {};
}

function insertPerMethod(
  node: RadixNodePerMethod,
  segments: PatternSegment[],
  payload: PerMethodPayload
): void {
  let n = node;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.type === "catchAll") {
      n.catchAll = { param: seg.param, route: payload };
      return;
    }
    if (seg.type === "static") {
      if (!n.static) n.static = new Map();
      let next = n.static.get(seg.value);
      if (!next) {
        next = createNodePerMethod();
        n.static.set(seg.value, next);
      }
      n = next;
      continue;
    }
    if (seg.type === "dynamic") {
      if (!n.dynamic) n.dynamic = { param: seg.param, node: createNodePerMethod() };
      n = n.dynamic.node;
      continue;
    }
  }
  n.route = payload;
}

export type RadixTreePerMethod = {
  match(pathname: string): MatchResultPerMethod | null;
};

/**
 * Build a radix tree for a single HTTP method (find-my-way style).
 * Lookup is O(path depth) with no method map; returns filePath directly.
 */
export function buildRadixTreeForMethod(
  routes: ScannedRoute[],
  method: string
): RadixTreePerMethod {
  const byPath = new Map<string, Record<string, string>>();
  for (const r of routes) {
    const pathname = r.pathname;
    let fileByMethod = byPath.get(pathname);
    if (!fileByMethod) {
      fileByMethod = {};
      byPath.set(pathname, fileByMethod);
    }
    fileByMethod[r.method ?? ""] = r.filePath;
  }

  const root = createNodePerMethod();
  for (const [pathname, fileByMethod] of byPath) {
    const filePath = fileByMethod[method] ?? fileByMethod[""];
    if (!filePath) continue;
    const segments = parsePatternSegments(pathname);
    insertPerMethod(root, segments, { routeId: pathname, filePath });
  }

  function match(pathname: string): MatchResultPerMethod | null {
    const urlSegments = tokenizePathname(pathname);
    const params: Record<string, string | string[]> = {};

    function walk(n: RadixNodePerMethod, segIndex: number): MatchResultPerMethod | null {
      if (segIndex === urlSegments.length) {
        if (n.route) return { routeId: n.route.routeId, filePath: n.route.filePath, params: { ...params } };
        return null;
      }

      const seg = urlSegments[segIndex] ?? "";

      if (n.static) {
        const next = n.static.get(seg);
        if (next) {
          const result = walk(next, segIndex + 1);
          if (result) return result;
        }
      }

      if (n.dynamic) {
        params[n.dynamic.param] = decodeIfNeeded(seg);
        const result = walk(n.dynamic.node, segIndex + 1);
        if (result) return result;
        delete params[n.dynamic.param];
      }

      if (n.catchAll) {
        params[n.catchAll.param] = urlSegments.slice(segIndex).map(decodeIfNeeded);
        return {
          routeId: n.catchAll.route.routeId,
          filePath: n.catchAll.route.filePath,
          params: { ...params }
        };
      }

      return null;
    }

    return walk(root, 0);
  }

  return { match };
}
