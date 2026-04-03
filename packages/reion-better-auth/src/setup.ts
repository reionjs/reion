import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { stdin as stdinStream, stdout as stdoutStream } from "node:process";
import { createInterface } from "node:readline/promises";

import type { ReionPluginSetupFn } from "reion";

type DatabaseKind = "sqlite" | "postgres" | "mysql" | "manual";

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

function authPluginTemplate(packageName: string, kind: DatabaseKind): string {
  const baseImport = `import { BetterAuthPlugin } from "${packageName}";
import { betterAuth } from "better-auth";
`;

  switch (kind) {
    case "sqlite":
      return (
        baseImport +
        `import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const dbPath = resolve(process.cwd(), "db/sqlite.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

export const auth = betterAuth({
  database: new Database(dbPath),
});

export const betterAuthPlugin = BetterAuthPlugin({
  auth,
});
`
      );
    case "postgres":
      return (
        baseImport +
        `import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/mydb",
});

export const auth = betterAuth({
  database: pool,
});

export const betterAuthPlugin = BetterAuthPlugin({
  auth,
});
`
      );
    case "mysql":
      return (
        baseImport +
        `import { createPool } from "mysql2";

const pool = createPool(process.env.DATABASE_URL ?? "mysql://localhost:3306/mydb");

export const auth = betterAuth({
  database: pool,
});

export const betterAuthPlugin = BetterAuthPlugin({
  auth,
});
`
      );
    case "manual":
      return (
        baseImport +
        `import { memoryAdapter } from "better-auth/adapters/memory";

/** Replace with your database (pg, mysql2, better-sqlite3, Drizzle, Prisma, etc.). */
export const auth = betterAuth({
  database: memoryAdapter({}),
});

export const betterAuthPlugin = BetterAuthPlugin({
  auth,
});
`
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

const AUTH_ROUTE_TEMPLATE = (packageName: string) => `import { createBetterAuthRouteHandler } from "${packageName}";
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

function depsForKind(kind: DatabaseKind): string[] {
  switch (kind) {
    case "sqlite":
      return ["better-sqlite3", "@types/better-sqlite3"];
    case "postgres":
      return ["pg", "@types/pg"];
    case "mysql":
      return ["mysql2"];
    case "manual":
      return [];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

async function promptDatabaseKind(ctx: {
  log: { info: (msg: string) => void };
}): Promise<DatabaseKind> {
  if (!stdinStream.isTTY || !stdoutStream.isTTY) {
    ctx.log.info(
      "Non-interactive mode: using Simple (SQLite file). Set src/plugins/better-auth.ts to another database if needed.",
    );
    return "sqlite";
  }

  ctx.log.info(
    [
      "Better Auth — choose a database setup:",
      "  1) Simple — SQLite file at db/sqlite.sqlite (good for local dev)",
      "  2) PostgreSQL — pg Pool (uses DATABASE_URL)",
      "  3) MySQL — mysql2 pool (uses DATABASE_URL)",
      "  4) Manual — in-memory adapter only; swap in your own ORM/database later",
      "",
    ].join("\n"),
  );

  const rl = createInterface({ input: stdinStream, output: stdoutStream });
  try {
    const raw = (await rl.question("Enter 1–4 [1]: ")).trim();
    const n = raw === "" ? 1 : Number.parseInt(raw, 10);
    if (n === 2) return "postgres";
    if (n === 3) return "mysql";
    if (n === 4) return "manual";
    return "sqlite";
  } finally {
    rl.close();
  }
}

export const setup: ReionPluginSetupFn = async (ctx) => {
  const appDir = join(ctx.cwd, "src");
  const pluginPath = join(appDir, "plugins", "better-auth.ts");
  const authRoutePath = join(appDir, "router", "api", "auth", "[[...params]]", "route.ts");
  const scaffoldTargets = [pluginPath, authRoutePath];
  const existing = scaffoldTargets.filter((p) => existsSync(p));
  const rel = (absPath: string) => relative(ctx.cwd, absPath).replace(/\\/g, "/");

  const kind = await promptDatabaseKind(ctx);
  const pkg = ctx.packageName;

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

  const willRefreshScaffold = existing.length === 0 || overwriteExisting;

  if (!ctx.skipInstall && ctx.installDependencies && willRefreshScaffold) {
    const deps = depsForKind(kind);
    if (deps.length > 0) {
      ctx.installDependencies(deps);
    }
  } else if (!ctx.skipInstall && willRefreshScaffold && depsForKind(kind).length > 0 && !ctx.installDependencies) {
    ctx.log.warn(
      "Could not install database packages (no installer in context). Run your package manager, e.g.: npm install " +
        depsForKind(kind).join(" "),
    );
  }

  const pluginSource = authPluginTemplate(pkg, kind);
  const routeSource = AUTH_ROUTE_TEMPLATE(pkg);

  if (overwriteExisting) {
    writeAlways(pluginPath, pluginSource);
    writeAlways(authRoutePath, routeSource);
  } else {
    writeIfMissing(pluginPath, pluginSource);
    writeIfMissing(authRoutePath, routeSource);
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
