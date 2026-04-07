import type { AddressInfo } from "node:net";
import {
  createNodeServer,
  loadConfig,
  getAppDir,
  getRequestHandlerOptionsFromConfig,
  type ReionConfig,
} from "reion";

export type CreateTestServerOptions = {
  /** Project root containing `reion.config.*` (default: `process.cwd()`). */
  cwd?: string | undefined;
  /** Override `appDir` from config. */
  appDir?: string | undefined;
  /** Bind address (default: `127.0.0.1`). */
  host?: string | undefined;
};

export type TestServer = {
  baseUrl: string;
  port: number;
  host: string;
  config: ReionConfig;
  /** Resolved app directory used for routes. */
  appDir: string;
  close: () => Promise<void>;
};

function getLocalUrl(hostname: string, port: number): string {
  if (
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return `http://localhost:${port}`;
  }
  return `http://${hostname}:${port}`;
}

/**
 * Start a real HTTP server on an ephemeral port using the same handler as `reion dev` / `reion start`.
 */
export async function createTestServer(
  opts: CreateTestServerOptions = {},
): Promise<TestServer> {
  const cwd = opts.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const resolvedAppDir = opts.appDir ?? getAppDir(config, cwd);
  if (!resolvedAppDir) {
    throw new Error(
      "Reion app directory not found. Set `appDir` in reion.config or pass `appDir` to createTestServer.",
    );
  }
  const handlerOptions = getRequestHandlerOptionsFromConfig(config, cwd, {
    appDir: resolvedAppDir,
  });
  // Tests should be quiet by default: disable request tracing/log mirroring.
  handlerOptions.tracing = false;

  const host = opts.host ?? "127.0.0.1";
  const nodeServer = createNodeServer({
    ...handlerOptions,
    port: 0,
    hostname: host
  });

  await nodeServer.listen();

  const addr = nodeServer.server.address() as AddressInfo | string | null;
  if (!addr || typeof addr === "string") {
    await nodeServer.close();
    throw new Error("Could not read server address after listen");
  }

  const port = addr.port;
  const baseUrl = getLocalUrl(host, port);

  return {
    baseUrl,
    port,
    host,
    config,
    appDir: resolvedAppDir,
    close: () => nodeServer.close(),
  };
}
