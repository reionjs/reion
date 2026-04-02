import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { stdin as stdinStream, stdout as stdoutStream } from "node:process";
import { createInterface } from "node:readline/promises";

import type { ReionPluginSetupFn } from "reion";

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeIfMissing(path: string, contents: string): void {
  if (existsSync(path)) return;
  ensureDir(path);
  writeFileSync(path, contents, "utf8");
}

function writeAlways(path: string, contents: string): void {
  ensureDir(path);
  writeFileSync(path, contents, "utf8");
}

const AUTH_PLUGIN_TEMPLATE = `import { BetterAuthPlugin } from "@reion/better-auth";
import { betterAuth } from "better-auth";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const dbPath = resolve(process.cwd(), "db/sqlite.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

export const auth = betterAuth({
  // Configure providers/adapters here.
  database: new Database(dbPath),
});

export const betterAuthPlugin = BetterAuthPlugin({
  auth,
});
`;

const AUTH_ROUTE_TEMPLATE = `import { createBetterAuthRouteHandler } from "@reion/better-auth";
import { auth } from "@/plugins/better-auth.js";

const handleAuth = createBetterAuthRouteHandler(auth);
export const RAW_BODY = true;

export const GET = handleAuth;
export const POST = handleAuth;
export const PUT = handleAuth;
export const PATCH = handleAuth;
export const DELETE = handleAuth;
export const OPTIONS = handleAuth;
`;

export const setup: ReionPluginSetupFn = async (ctx) => {
  const appDir = join(ctx.cwd, "src");
  const pluginPath = join(appDir, "plugins", "better-auth.ts");
  const authRoutePath = join(appDir, "router", "api", "auth", "[[...params]]", "route.ts");
  const scaffoldTargets = [pluginPath, authRoutePath];
  const existing = scaffoldTargets.filter((p) => existsSync(p));
  const rel = (absPath: string) => relative(ctx.cwd, absPath).replace(/\\/g, "/");

  let overwriteExisting = false;
  if (existing.length > 0) {
    ctx.log.warn(
      [
        "Better Auth setup found existing files:",
        ...existing.map((p) => `- ${rel(p)}`),
        "Overwrite these files?",
      ].join("\n"),
    );
    if (stdinStream.isTTY && stdoutStream.isTTY) {
      const rl = createInterface({ input: stdinStream, output: stdoutStream });
      try {
        const raw = (await rl.question("Overwrite existing files? (Y/n): ")).trim();
        const ans = raw.toLowerCase();
        // Default is YES on empty input.
        if (ans === "" || ans === "y" || ans === "yes") overwriteExisting = true;
        else if (ans === "n" || ans === "no") overwriteExisting = false;
        else overwriteExisting = true;
      } finally {
        rl.close();
      }
      if (!overwriteExisting) {
        ctx.log.info(["Skipped (kept existing files):", ...existing.map((p) => `- ${rel(p)}`)].join("\n"));
      }
    } else {
      ctx.log.info("Non-interactive mode: keeping existing files.");
      ctx.log.info(["Skipped (kept existing files):", ...existing.map((p) => `- ${rel(p)}`)].join("\n"));
    }
  }

  if (overwriteExisting) {
    writeAlways(pluginPath, AUTH_PLUGIN_TEMPLATE);
    writeAlways(authRoutePath, AUTH_ROUTE_TEMPLATE);
  } else {
    writeIfMissing(pluginPath, AUTH_PLUGIN_TEMPLATE);
    writeIfMissing(authRoutePath, AUTH_ROUTE_TEMPLATE);
  }

  const result = await ctx.addPluginToReionConfig({
    imports: [{ kind: "named", names: ["betterAuthPlugin"], module: "./src/plugins/better-auth" }],
    pluginExpressions: ["betterAuthPlugin"],
    removePluginCalleeNames: ["BetterAuthPlugin"],
  });

  if (!result.ok) {
    ctx.log.warn(`Could not auto-edit reion.config.ts: ${result.error}`);
    ctx.log.warn("Add `betterAuthPlugin` to `plugins: []` manually.");
    return;
  }

  ctx.log.info("Better Auth plugin added.");
};

