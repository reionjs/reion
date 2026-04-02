import { resolve, relative, join } from "node:path";
import { existsSync } from "node:fs";
import { setupServer } from "../../src/server/server.js";
import { loadConfig, getBuildPath, getAppDir } from "../../src/config/loadConfig.js";
import { validateApp } from "../../src/validation/validateApp.js";
import { runPluginHook } from "../pluginHooks.js";
import { appLogger } from "../../src/utils/logger.js";
import runServer from "../runServer.js";

export type StartOptions = {
  port?: string;
  host?: string;
  buildPath?: string;
};

export const startCommand = {
  name: "reion start",
  run: (opts: StartOptions = {}) => {
    runServer(opts)
  }
} as const;
