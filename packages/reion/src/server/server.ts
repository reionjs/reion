import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";

import {
  handleNodeRequest,
  warmRuntime,
  type RequestHandlerOptions,
} from "./requestHandler.js";
import {
  getRequestHandlerOptionsFromConfig,
  type ReionConfig,
} from "../config/loadConfig.js";
import { getRouteTable } from "../router/routeTable.js";
import { appLogger } from "../utils/logger.js";

export type NodeServerOptions = RequestHandlerOptions & {
  port?: number;
  hostname?: string;
  onListen?: (info: { port: number; hostname: string }) => void;
  appDir?: string;
};

function getLanAddress(): string | null {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const info of entries) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return null;
}

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


export function createNodeServer(options: NodeServerOptions = {}) {

  const port = options.port ?? 3000;
  const hostname = options.hostname ?? "127.0.0.1";

  let isListening = false;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    handleNodeRequest(req, res, options);
  });

  async function listen() {
    if (isListening) return;

    await warmRuntime(options);

    return new Promise<void>((resolve, reject) => {
      if (isListening) return;
      server.listen(port);

      server.once("listening", () => {
        isListening = true;
        options.onListen?.({ port, hostname });
        resolve();
      });

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          appLogger.error(`Port ${port} is already in use`);
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  async function close() {
    if (!isListening) return;

    return new Promise<void>((resolve, reject) => {
      server.close((err) => {
        isListening = false;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return {
    server,
    listen,
    close,
    isListening,
  };
}

export function setupServer(
  config: ReionConfig,
  cwd: string,
  appDir: string,
  port: number,
  host: string,
): ReturnType<typeof createNodeServer> | null {
  try {
    getRouteTable(appDir);
    return createNodeServer({
      ...getRequestHandlerOptionsFromConfig(config, cwd, { appDir }),
      port,
      hostname: host,
      onListen: ({ hostname, port: p }) => {
        const local = getLocalUrl(hostname, p);
        const lan = getLanAddress();
        const lines = [`- Local:         ${local}`];
        if (lan) lines.push(`- Network:       http://${lan}:${p}`);
        appLogger.info(lines.join("\n"));
      },
    });
  } catch (error: any) {
    appLogger.error("Failed to setup server\n", error.message);
  }
  return null;
}
