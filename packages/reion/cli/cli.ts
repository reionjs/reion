#!/usr/bin/env node

/** Load tsx so Node can load .ts route files; no-op on Bun (uses native .ts). */
if (typeof (globalThis as any).Bun === "undefined") {
  try {
    // @ts-expect-error - tsx/esm has no type declarations
    await import("tsx/esm");
  } catch {
    // tsx not available; user may need: node --import tsx/esm ... or Bun
  }
}

import { program } from "commander";
import { createRequire } from "node:module";
import { devCommand } from "./commands/dev.js";
import { buildCommand } from "./commands/build.js";
import { startCommand } from "./commands/start.js";
import { createCommand } from "./commands/create.js";
import { addCommand } from "./commands/add.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version?: string };

program
  .name("reion")
  .description("Reion framework CLI")
  .version(pkg.version ?? "0.0.1");

program
  .command("dev")
  .description("Run the app with hot reload")
  .option("-p, --port <number>", "Port to listen on (default: 3000)")
  .option("-H, --host <string>", "Hostname to bind (default: 127.0.0.1)")
  .option("--appDir <path>", "App directory (default: ./app)")
  .option("--hot-reload-stop", "Restart server on app file changes instead of in-process reload")
  .action((opts) => devCommand.run(opts));

program
  .command("build")
  .description("Build the app for production")
  .option("--build-path <path>", "Output directory (overrides config)")
  .action((opts) => buildCommand.run(opts));

program
  .command("create [name]")
  .description("Create a new Reion project (local scaffold, or clone a template via -t)")
  .option(
    "-t, --template <value>",
    "Template: built-in name (e.g. basic) or git URL / github.com/.../tree/branch/path",
  )
  .option("--no-install", "Skip npm/bun install")
  .action(
    async (
      name: string | undefined,
      cmd?: { opts: () => { install?: boolean; template?: string } },
    ) => {
      const opts = cmd?.opts?.() ?? {};
      const runOpts: { name?: string; noInstall: boolean; template?: string } = {
        noInstall: opts.install === false,
      };
      if (name !== undefined) runOpts.name = name;
      if (opts.template !== undefined && opts.template !== "") {
        runOpts.template = opts.template;
      }
      await createCommand.run(runOpts);
    },
  );

program
  .command("start")
  .description("Run the built app (no hot reload)")
  .option("-p, --port <number>", "Port (default: 3000)")
  .option("-H, --host <string>", "Hostname (default: 127.0.0.1)")
  .option("--build-path <path>", "Built app directory (overrides config)")
  .action((opts) => startCommand.run(opts));

program
  .command("add")
  .description("Install a Reion plugin package and run its setup script when available")
  .requiredOption("-p, --plugin <name>", "npm package name (e.g. @reion/prisma)")
  .option(
    "--skip-install",
    "Skip installing the plugin with the package manager; setup still runs (e.g. prisma init for @reion/prisma)",
  )
  .action(async (opts: { plugin: string; skipInstall?: boolean }) => {
    await addCommand.run({
      plugin: opts.plugin,
      cwd: process.cwd(),
      noInstall: opts.skipInstall === true,
    });
  });

async function main() {
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
