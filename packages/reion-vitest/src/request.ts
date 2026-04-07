function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export type ReionRequestClient = {
  get: (path: string, init?: RequestInit) => Promise<Response>;
  post: (
    path: string,
    body?: unknown,
    init?: RequestInit,
  ) => Promise<Response>;
  put: (
    path: string,
    body?: unknown,
    init?: RequestInit,
  ) => Promise<Response>;
  patch: (
    path: string,
    body?: unknown,
    init?: RequestInit,
  ) => Promise<Response>;
  delete: (path: string, init?: RequestInit) => Promise<Response>;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
};

function jsonInit(
  method: string,
  body: unknown | undefined,
  init?: RequestInit,
): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const out: RequestInit = {
    ...init,
    method,
    headers,
  };
  if (body !== undefined) {
    out.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return out;
}

/**
 * Minimal fetch wrapper rooted at `baseUrl` (from the test server).
 */
export function createRequestClient(baseUrl: string): ReionRequestClient {
  const fetchPath = (path: string, init?: RequestInit) =>
    fetch(joinUrl(baseUrl, path), init);

  return {
    get: (path, init) => fetchPath(path, { ...init, method: "GET" }),
    post: (path, body, init) =>
      fetchPath(path, jsonInit("POST", body, init)),
    put: (path, body, init) =>
      fetchPath(path, jsonInit("PUT", body, init)),
    patch: (path, body, init) =>
      fetchPath(path, jsonInit("PATCH", body, init)),
    delete: (path, init) => fetchPath(path, { ...init, method: "DELETE" }),
    fetch: fetchPath,
  };
}
