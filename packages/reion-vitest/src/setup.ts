import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { stdin as stdinStream, stdout as stdoutStream } from "node:process";
import { createInterface } from "node:readline/promises";
import type { ReionPluginSetupFn } from "reion";

const VITEST_CONFIG_TEMPLATE = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
`;

const VITEST_CONFIG_WITH_ALIAS_TEMPLATE = `import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
  },
});
`;

type PackageJsonShape = {
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

async function askEnableAlias(log: { info: (msg: string) => void }): Promise<boolean> {
  if (!stdinStream.isTTY || !stdoutStream.isTTY) {
    return false;
  }

  log.info(
    "Optional: setup `@` alias in vitest.config.ts (`@` -> ./src) to match tsconfig paths.",
  );
  const rl = createInterface({ input: stdinStream, output: stdoutStream });
  try {
    const raw = (await rl.question("Add alias config? (Y/n): ")).trim().toLowerCase();
    return raw === "" || raw === "y" || raw === "yes";
  } finally {
    rl.close();
  }
}

async function writeVitestConfigIfMissing(
  cwd: string,
  log: { info: (msg: string) => void },
): Promise<void> {
  const configPath = join(cwd, "vitest.config.ts");
  if (existsSync(configPath)) {
    log.info("Skipped vitest.config.ts (already exists).");
    return;
  }
  const useAlias = await askEnableAlias(log);
  writeFileSync(
    configPath,
    useAlias ? VITEST_CONFIG_WITH_ALIAS_TEMPLATE : VITEST_CONFIG_TEMPLATE,
    "utf8",
  );
  log.info("Created vitest.config.ts.");
}

function ensureTestScript(cwd: string, log: { info: (msg: string) => void; warn: (msg: string) => void }): void {
  const packageJsonPath = join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    log.warn("package.json not found; could not add test script.");
    return;
  }
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as PackageJsonShape;
  const scripts = { ...(parsed.scripts ?? {}) };
  if (scripts.test === "vitest run") {
    log.info("Skipped package.json test script (already set to `vitest run`).");
    return;
  }
  scripts.test = "vitest run";
  parsed.scripts = scripts;
  writeFileSync(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  log.info("Updated package.json with `test: vitest run`.");
}

export const setup: ReionPluginSetupFn = async (ctx) => {
  if (!ctx.skipInstall && ctx.installDependencies) {
    ctx.installDependencies(["vitest"]);
  } else if (ctx.skipInstall) {
    ctx.log.warn("Skipped dependency installation (--skip-install). Install `vitest` manually.");
  }

  await writeVitestConfigIfMissing(ctx.cwd, ctx.log);
  ensureTestScript(ctx.cwd, ctx.log);

  const rel = (p: string) => relative(ctx.cwd, p).replace(/\\/g, "/");
  ctx.log.info(
    [
      "Vitest setup complete.",
      `- ${rel(join(ctx.cwd, "vitest.config.ts"))}`,
      "- package.json script: test",
    ].join("\n"),
  );
};

