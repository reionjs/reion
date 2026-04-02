import { join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import { getAppDir, getBuildPath, loadConfig } from "../src/config/loadConfig.js";
import type { StartOptions } from "./commands/start.js";
import { appLogger } from "../src/utils/logger.js";
import { runPluginHook } from "./pluginHooks.js";
import { validateApp } from "../src/validation/validateApp.js";
import { setupServer } from "../src/server/server.js";

const runServer = async (opts: StartOptions={}) => {
    const host = opts.host ?? "127.0.0.1";
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const plugins = config.plugins;
    const buildPath = opts.buildPath ? resolve(cwd, opts.buildPath) : getBuildPath(config, cwd);
    // Built app lives at buildPath/app (same structure as source appDir)
    const currentAppDir = getAppDir(config, cwd);
    const appDirRelative = relative(cwd, currentAppDir||"");
    const appDir = join(buildPath, appDirRelative);
    if (!existsSync(appDir)) {
      appLogger.error(`Built app dir not found: ${appDir}. Run "reion build" first, or check --build-path.`);
      process.exit(1);
    }

    const port = opts.port ? Number(opts.port) : (config.port ?? 3000);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`Invalid --port: ${opts.port ?? config.port ?? ""}`);
    }
    await runPluginHook(plugins, "onStartStart", {
      command: "start",
      cwd,
      appDir,
      host,
      port,
      buildPath,
    });

    const isValid = await validateApp(appDir);
    if (!isValid) {
      appLogger.error("Failed to validate the app");
      process.exit(1);
    }
    const app = setupServer(config, cwd, appDir, port, host);

    if (app) {
      await app.listen();
      await runPluginHook(plugins, "onStartListening", {
        command: "start",
        cwd,
        appDir,
        host,
        port,
        buildPath,
      });
    } else {
      await runPluginHook(plugins, "onStartError", {
        command: "start",
        cwd,
        appDir,
        host,
        port,
        buildPath,
        error: new Error("Failed to start the server"),
      });
      appLogger.error("Failed to start the server");
      process.exit(1);
    }

    const onSignal = () => {
      void runPluginHook(plugins, "onStartStop", {
        command: "start",
        cwd,
        appDir,
        host,
        port,
        buildPath,
        reason: "signal",
      });
      void app?.close().catch(() => {});
      process.exit(0);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
};

export default runServer;