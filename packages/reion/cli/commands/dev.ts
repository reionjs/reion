import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { watch, type FSWatcher, existsSync } from "node:fs";
import { createNodeServer, setupServer } from "../../src/server/server.js";
import {
  clearRuntimeCache,
  clearTurboPlanCache,
} from "../../src/server/requestHandler.js";
import { loadConfig, getAppDir } from "../../src/config/loadConfig.js";
import { validateApp } from "../../src/validation/validateApp.js";
import { clearPipelineCache } from "../../src/pipeline/pipelineCache.js";
import { clearMiddlewareTableCache } from "../../src/middleware/middlewareTable.js";
import { clearMiddlewareResolverCache } from "../../src/middleware/middlewareResolver.js";
import {
  clearEventBusCache,
  isLikelyEventHandlerFilename,
} from "../../src/events/eventExecutor.js";
import { clearRouteSecurityConfigCache } from "../../src/security/securityConfigLoader.js";
import { reloadRoutes } from "../../src/router/routeLoader.js";
import { runPluginHook } from "../pluginHooks.js";
import { appLogger } from "../../src/utils/logger.js";

export type DevOptions = {
  port?: string;
  host?: string;
  appDir?: string;
  hotReloadStop?: boolean;
};

const WATCH_FILES_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".json"];
const WATCH_FILES_EXTENSIONS_REGEX = new RegExp(
  `(${WATCH_FILES_EXTENSIONS.join("|")})$`,
);

function isWatchFile(filename: string): "watch" | "incomingMessage" | "other" {
  if (
    WATCH_FILES_EXTENSIONS_REGEX.test(filename) &&
    !filename.startsWith(".reion")
  ) {
    return "watch";
  } else {
    return "other";
  }
}

async function run(opts: DevOptions = {}) {
  const cwd = process.cwd();

  const config = await loadConfig(cwd);
  const plugins = config.plugins;
  const appDir = opts.appDir
    ? resolve(cwd, opts.appDir)
    : getAppDir(config, cwd);
  if (!appDir) {
    process.exit(1);
  }
  const port = opts.port ? Number(opts.port) : (config.port ?? 3000);
  const host = opts.host ?? "127.0.0.1";
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid --port: ${opts.port ?? config.port ?? ""}`);
  }
  await runPluginHook(plugins, "onDevStart", {
    command: "dev",
    cwd,
    appDir,
    host,
    port,
  });

  const CONFIG_FILES = [
    "reion.config.ts",
    "reion.config.js",
    "reion.config.mjs",
  ];
  const CONFIG_DEBOUNCE_MS = 200;
  const CONFIG_GRACE_MS = 300;
  const CONFIG_COOLDOWN_MS = 300;
  const appDirRef = { current: appDir };
  let restartChild: ChildProcess | null = null;
  let configWatchStartTime = 0;
  let lastRestartTime = 0;

  function killChild() {
    if (!restartChild?.pid) return;
    try {
      if (process.platform !== "win32") {
        process.kill(-restartChild.pid, "SIGKILL");
      } else {
        process.kill(restartChild.pid, "SIGKILL");
      }
    } catch {
      try {
        process.kill(restartChild.pid, "SIGKILL");
      } catch {
        restartChild.kill("SIGKILL");
      }
    }
    restartChild = null;
  }

  let app: ReturnType<typeof createNodeServer> | null = setupServer(
    config,
    cwd,
    appDir,
    port,
    host,
  );

  let isValid = await validateApp(appDir);

  if (app && isValid) {
    await app.listen();
  }

  let appDirWatcher: FSWatcher | null = null;

  function startAppDirWatcher(dir: string) {
    appDirWatcher?.close();
    appDirWatcher = watch(
      dir,
      { recursive: true },
      async (_event, filename) => {
        if (!filename || isWatchFile(filename) === "other") return;
        const currentDir = appDirRef.current;
        const changedPath = resolve(cwd, filename);

        const fileType = getFileTypeForReload(filename);

        const fileExists = existsSync(changedPath);

        if (fileType === "route") {
          await reloadRoutes({ currentDir, changedPath, fileExists, filename });
          clearTurboPlanCache(currentDir);
        } else if (fileType === "middleware") {
          process.env.REION_MIDDLEWARE_RELOAD_TOKEN = String(Date.now());
          clearMiddlewareTableCache(currentDir);
          clearMiddlewareResolverCache(currentDir);
          clearPipelineCache(currentDir);
          clearTurboPlanCache(currentDir);
          appLogger.info(`[reion] reload: middleware (${filename})`);
        } else if (fileType === "security") {
          process.env.REION_SECURITY_RELOAD_TOKEN = String(Date.now());
          clearRouteSecurityConfigCache(currentDir);
          clearRuntimeCache(currentDir);
          clearTurboPlanCache(currentDir);
          appLogger.info(`[reion] reload: security (${filename})`);
        } else if (fileType === "event") {
          process.env.REION_EVENT_RELOAD_TOKEN = String(Date.now());
          clearEventBusCache(currentDir);
          clearRuntimeCache(currentDir);
          appLogger.info(`[reion] reload: events (${filename})`);
        } else if (fileType === "plugin") {
          restartCommand({ reason: "plugin-change" });
        } else {
          appLogger.info(
            `[reion] reload: Changes Detected in (${filename})`,
          );
          restartCommand();
          return;
        }

        await runPluginHook(plugins, "onDevFileChange", {
          command: "dev",
          cwd,
          appDir: currentDir,
          filename,
          changedPath,
          fileExists,
          fileType,
        });

        const changedFolder = dirname(changedPath);
        const isValid = await validateApp(changedFolder, {
          isBuild: false,
          isRecursive: false,
        });
        if (!isValid) {
          await app?.close();
          return;
        }
        if (app && !app.isListening && isValid) {
          await app.listen();
        }
      },
    );
  }

  let restartTimeout: ReturnType<typeof setTimeout> | null = null;
  let restartInProgress = false;

  function restartCommand(
    opts: { reason?: "config-change" | "plugin-change" } = {},
  ) {
    if (restartInProgress) return;
    if (
      configWatchStartTime &&
      Date.now() - configWatchStartTime < CONFIG_GRACE_MS
    )
      return;
    if (lastRestartTime && Date.now() - lastRestartTime < CONFIG_COOLDOWN_MS)
      return;
    if (restartTimeout) clearTimeout(restartTimeout);
    const restartReason = opts.reason ?? "";
    restartTimeout = setTimeout(async () => {
      restartTimeout = null;
      if (restartInProgress) return;
      if (lastRestartTime && Date.now() - lastRestartTime < CONFIG_COOLDOWN_MS)
        return;
      restartInProgress = true;
      try {
        await app?.close().catch(() => {});
        if (restartChild?.pid) {
          try {
            process.kill(restartChild.pid, "SIGTERM");
          } catch {
            process.kill(restartChild.pid, "SIGKILL");
          }
          restartChild = null;
        }
        await new Promise((r) => setTimeout(r, 500));
        appLogger.info(
          restartReason === "plugin-change"
            ? "[reion] plugins changed, restarting..."
            : restartReason === "config-change"
              ? "[reion] config changed, restarting..."
              : "[reion] changes detected, restarting...",
        );
        await runPluginHook(plugins, "onDevRestart", {
          command: "dev",
          cwd,
          appDir: appDirRef.current,
          host,
          port,
          reason: restartReason,
        });
        const exec = process.argv[0] ?? process.execPath;
        const args = process.argv.slice(1);
        restartChild = spawn(exec, args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: "inherit",
          detached: process.platform !== "win32",
        });
        restartChild.on("exit", () => {
          restartChild = null;
        });
        lastRestartTime = Date.now();
      } finally {
        restartInProgress = false;
      }
    }, CONFIG_DEBOUNCE_MS);
  }

  configWatchStartTime = Date.now();
  const configWatcher = watch(cwd, { recursive: false }, (_event, filename) => {
    if (filename && CONFIG_FILES.includes(filename)) {
      restartCommand();
    }
  });

  startAppDirWatcher(cwd);

  function onSignal() {
    void runPluginHook(plugins, "onDevStop", {
      command: "dev",
      cwd,
      appDir: appDirRef.current,
      host,
      port,
      reason: "signal",
    });
    appLogger.info("[reion] closing the app...");
    app?.close().catch(() => {});
    killChild();
    appDirWatcher?.close();
    configWatcher?.close();
    process.exit(0);
  }
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

function getFileTypeForReload(
  filename: string,
): "route" | "middleware" | "security" | "event" | "plugin" | "other" {
  if (
    /(?:route\.(ts|js|mts|mjs)$|(?:get|post|put|patch|delete|head|options)(?:\.route)?\.(ts|js|mts|mjs)$)/.test(
      filename,
    )
  ) {
    return "route";
  } else if (/middleware\.(ts|js|mts|mjs)$/.test(filename)) {
    return "middleware";
  } else if (/security\.(ts|js|mts|mjs)$/.test(filename)) {
    return "security";
  } else if (isLikelyEventHandlerFilename(filename)) {
    return "event";
  } else if (filename.startsWith("plugins/") || filename.includes("plugins/")) {
    return "plugin";
  }
  return "other";
}

export const devCommand = {
  name: "dev",
  run,
} as const;
