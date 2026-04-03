import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { addPluginToReionConfig } from "../../src/setup/addPluginToReionConfig.js";
import type { ReionPluginSetupFn } from "../../src/setup/pluginSetupTypes.js";
import { appLogger } from "../../src/utils/logger.js";

export type AddCommandOptions = {
  plugin: string;
  cwd: string;
  noInstall?: boolean;
};

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

function detectPackageManager(projectRoot: string): PackageManager {
  if (existsSync(join(projectRoot, "bun.lock")) || existsSync(join(projectRoot, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(projectRoot, "yarn.lock"))) return "yarn";
  return "npm";
}

function runInstallPackages(projectRoot: string, packageNames: string[]): void {
  if (packageNames.length === 0) return;
  const pm = detectPackageManager(projectRoot);
  const args: string[] =
    pm === "bun"
      ? ["add", ...packageNames]
      : pm === "npm"
        ? ["install", ...packageNames]
        : pm === "pnpm"
          ? ["add", ...packageNames]
          : ["add", ...packageNames];
  appLogger.info(`Installing ${packageNames.join(", ")} with ${pm}...`);
  execFileSync(pm, args, { cwd: projectRoot, stdio: "inherit" });
}

function runInstall(projectRoot: string, packageName: string): void {
  runInstallPackages(projectRoot, [packageName]);
}

const BETTER_AUTH_PACKAGES = new Set(["@reionjs/better-auth", "@reion/better-auth"]);

const SETUP_SUBPATH = "setup";

function setupSpecifier(packageName: string): string {
  return packageName.startsWith("@")
    ? `${packageName}/${SETUP_SUBPATH}`
    : `${packageName}/${SETUP_SUBPATH}`;
}

export const addCommand = {
  async run(opts: AddCommandOptions): Promise<void> {
    const { plugin: packageName, cwd, noInstall } = opts;
    if (!packageName?.trim()) {
      appLogger.error("Missing package name. Usage: reion add -p <package>");
      process.exit(1);
    }

    const trimmed = packageName.trim();
    if (!noInstall) {
      runInstall(cwd, trimmed);
      if (BETTER_AUTH_PACKAGES.has(trimmed)) {
        runInstallPackages(cwd, ["better-auth"]);
      }
    }

    const spec = setupSpecifier(trimmed);
    let setupFn: ReionPluginSetupFn | undefined;
    try {
      const mod = await import(/* webpackIgnore: true */ spec);
      setupFn = (mod.setup ?? mod.default) as ReionPluginSetupFn | undefined;
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException & { code?: string };
      if (
        err?.code === "ERR_MODULE_NOT_FOUND" ||
        err?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" ||
        err?.code === "ERR_UNSUPPORTED_DIR_IMPORT"
      ) {
        appLogger.info(
          "No setup script found for this package (missing exported `./setup` or `setup` function). Add the plugin to reion.config.ts manually.",
        );
        return;
      }
      appLogger.error(`Failed to load setup for ${packageName}: ${String(e)}`);
      process.exit(1);
    }

    if (typeof setupFn !== "function") {
      appLogger.info(
        "No setup function found for this package (expected named export `setup` or default export). Add the plugin to reion.config.ts manually.",
      );
      return;
    }

    const ctx = {
      cwd,
      packageName: trimmed,
      skipInstall: noInstall === true,
      ...(noInstall === true
        ? {}
        : {
            installDependencies: (packages: string[]) => {
              runInstallPackages(cwd, packages);
            },
          }),
      addPluginToReionConfig: (input: Parameters<typeof addPluginToReionConfig>[1]) =>
        addPluginToReionConfig(cwd, input),
      log: {
        info: (msg: string) => appLogger.info(msg),
        warn: (msg: string) => appLogger.warn(msg),
        error: (msg: string) => appLogger.error(msg),
      },
    };

    try {
      await setupFn(ctx);
    } catch (e) {
      appLogger.error(`Setup failed: ${String(e)}`);
      process.exit(1);
    }
  },
};
