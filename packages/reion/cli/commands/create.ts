import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, execSync, spawn } from "node:child_process";
import { ExitPromptError } from "@inquirer/core";
import { input, select } from "@inquirer/prompts";
import { appLogger } from "../../src/utils/logger.js";

export type CreateOptions = {
  /** Project name or "." for current directory; undefined = prompt user */
  name?: string;
  /** Skip package manager install */
  noInstall?: boolean;
  /**
   * Template: built-in key from `BUILTIN_TEMPLATES`, a Git clone URL, or a GitHub folder link
   * (`https://github.com/owner/repo/tree/branch/path`).
   * Undefined = prompt to pick a template or default scaffold.
   */
  template?: string;
};

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/**
 * Built-in template name → source:
 * - Full git remote (`.git` or `git@...`), or
 * - GitHub browser URL: `https://github.com/{owner}/{repo}/tree/{branch}/{path}` (sparse checkout of that folder).
 * Keys are matched case-insensitively when using `-t <name>`.
 */
export const BUILTIN_TEMPLATES: Record<string, string> = {
  basic: "https://github.com/reionjs/reion/tree/main/templates/basic",
};

const DEFAULT_SCAFFOLD_VALUE = "__default_scaffold__";

function isPackageManagerAvailable(cmd: PackageManager): boolean {
  try {
    execSync(`${cmd} --version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getAvailablePackageManagers(): PackageManager[] {
  const all: PackageManager[] = ["npm", "yarn", "pnpm", "bun"];
  return all.filter(isPackageManagerAvailable);
}

function isGitAvailable(): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** True if `-t` value should be treated as a clone URL / GitHub link, not a template key. */
function looksLikeGitUrl(value: string): boolean {
  const v = value.trim();
  if (/^git@[^:]+:.+/i.test(v)) return true;
  if (/^https?:\/\//i.test(v)) return true;
  return false;
}

/** `https://github.com/owner/repo/tree/branch/path/inside/repo` */
type ParsedGithubTree = {
  owner: string;
  repo: string;
  branch: string;
  /** Path inside repo, e.g. `templates/basic` */
  path: string;
};

function parseGithubTreeBrowserUrl(url: string): ParsedGithubTree | null {
  const u = url.trim();
  const m = u.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/i,
  );
  if (!m) return null;
  const [, owner, repo, branch, pathPart] = m;
  if (!owner || !repo || !branch || !pathPart) return null;
  const path = pathPart.split(/[?#]/)[0]?.replace(/\/+$/, "") ?? "";
  if (!path) return null;
  return { owner, repo, branch, path };
}

function resolveBuiltinTemplateKey(inputKey: string): string | undefined {
  const k = inputKey.trim();
  if (BUILTIN_TEMPLATES[k] !== undefined) return k;
  const lower = k.toLowerCase();
  for (const name of Object.keys(BUILTIN_TEMPLATES)) {
    if (name.toLowerCase() === lower) return name;
  }
  return undefined;
}

function resolveCloneUrl(templateOpt: string): string {
  const t = templateOpt.trim();
  if (looksLikeGitUrl(t)) return t;
  const key = resolveBuiltinTemplateKey(t);
  if (key !== undefined) return BUILTIN_TEMPLATES[key]!;
  const known = Object.keys(BUILTIN_TEMPLATES);
  const hint =
    known.length > 0
      ? `Use a built-in name (${known.join(", ")}) or pass a Git clone URL with -t.`
      : "Pass a Git clone URL with -t, or add names and URLs to BUILTIN_TEMPLATES.";
  throw new Error(`Unknown template "${t}". ${hint}`);
}

async function resolveTemplateChoice(
  templateOpt: string | undefined,
): Promise<{ mode: "clone"; url: string } | { mode: "scaffold" }> {
  if (templateOpt !== undefined && templateOpt.trim() !== "") {
    const url = resolveCloneUrl(templateOpt);
    return { mode: "clone", url };
  }

  const builtinChoices = Object.keys(BUILTIN_TEMPLATES).map((name) => ({
    name: `${name} (${BUILTIN_TEMPLATES[name]})`,
    value: name,
    description: `Clone built-in template: ${name}`,
  }));

  const choices = [
    ...builtinChoices,
    {
      name: "Default (local starter — no git)",
      value: DEFAULT_SCAFFOLD_VALUE,
      description: "Minimal Reion app scaffold in this CLI",
    },
  ];

  const picked = await select({
    message: "Choose a template (use ↑/↓ arrows):",
    choices,
  });

  if (picked === DEFAULT_SCAFFOLD_VALUE) return { mode: "scaffold" };
  return { mode: "clone", url: BUILTIN_TEMPLATES[picked]! };
}

function assertDirEmptyForClone(dir: string, label: string): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir).filter(
    (e) => e !== ".git" && e !== ".DS_Store",
  );
  if (entries.length > 0) {
    appLogger.error(
      `${label} is not empty. Choose an empty directory or a new project name.`,
    );
    process.exit(1);
  }
}

/**
 * Sparse-checkout a subfolder from GitHub (browser `tree/branch/path` links).
 * Requires Git 2.25+ (`clone --sparse`).
 */
function cloneGithubTreeFolder(spec: ParsedGithubTree, targetDir: string): void {
  const remote = `https://github.com/${spec.owner}/${spec.repo}.git`;
  const tmpRoot = mkdtempSync(join(tmpdir(), "reion-create-"));
  const cloneDest = join(tmpRoot, "repo");

  try {
    appLogger.info(
      `  Cloning ${remote} @ ${spec.branch} (sparse: ${spec.path})`,
    );
    execFileSync(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "-b",
        spec.branch,
        "--sparse",
        remote,
        cloneDest,
      ],
      { stdio: "inherit" },
    );
    execFileSync("git", ["sparse-checkout", "set", spec.path], {
      cwd: cloneDest,
      stdio: "inherit",
    });
    const source = join(cloneDest, ...spec.path.split("/"));
    if (!existsSync(source)) {
      appLogger.error(
        `Sparse checkout did not produce "${spec.path}". Check branch and path.`,
      );
      process.exit(1);
    }
    cpSync(source, targetDir, { recursive: true });
  } catch {
    appLogger.error(
      "git sparse clone failed. Use Git 2.25+, check branch/path, and network access.",
    );
    process.exit(1);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  try {
    rmSync(join(targetDir, ".git"), { recursive: true, force: true });
  } catch {
    // optional
  }
}

/**
 * Clone into a temp directory, then copy into `targetDir`.
 * Supports full repo URLs and GitHub `.../tree/branch/path` links (sparse).
 * If the repo root is a single subdirectory, that folder is unwrapped.
 */
function cloneTemplateRepo(repoUrl: string, targetDir: string): void {
  if (!isGitAvailable()) {
    appLogger.error("git is not installed or not on PATH. Install git to clone templates.");
    process.exit(1);
  }

  assertDirEmptyForClone(targetDir, `Directory "${targetDir}"`);
  mkdirSync(targetDir, { recursive: true });

  const tree = parseGithubTreeBrowserUrl(repoUrl);
  if (tree) {
    cloneGithubTreeFolder(tree, targetDir);
    return;
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "reion-create-"));
  const cloneDest = join(tmpRoot, "repo");

  try {
    appLogger.info(`  Cloning ${repoUrl}`);
    execFileSync("git", ["clone", "--depth", "1", repoUrl, cloneDest], {
      stdio: "inherit",
    });

    const visible = readdirSync(cloneDest).filter((e) => e !== ".git");
    let source = cloneDest;
    if (visible.length === 1) {
      const one = join(cloneDest, visible[0]!);
      try {
        if (statSync(one).isDirectory()) source = one;
      } catch {
        // keep source = cloneDest
      }
    }

    cpSync(source, targetDir, { recursive: true });
  } catch {
    appLogger.error("git clone failed. Check the URL and your network access.");
    process.exit(1);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  try {
    rmSync(join(targetDir, ".git"), { recursive: true, force: true });
  } catch {
    // optional
  }
}

const PACKAGE_JSON = (name: string) => `{
  "name": "${name}",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "reion dev",
    "build": "reion build",
    "start": "reion start"
  },
  "dependencies": {
    "reion": "^0.0.2"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0"
  }
}
`;

const TSCONFIG_JSON = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "reion.config.ts"]
}
`;

const REION_CONFIG_TS = `import type { ReionConfig } from "reion";

const config: ReionConfig = {
  dev: {
    logPretty: true,
  },
};

export default config;
`;

const PING_ROUTE_TS = `import type { Context } from "reion";

export async function GET(ctx: Context) {
  ctx.res.status(200);
  return { message: "pong" };
}
`;

function sanitizePackageName(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "my-reion-app";
}

async function runInstall(targetDir: string, noInstall: boolean): Promise<boolean> {
  let depsInstalled = false;
  if (noInstall) {
    appLogger.info("  Run your package manager to install dependencies.");
    return false;
  }

  const available = getAvailablePackageManagers();
  if (available.length === 0) {
    appLogger.warn("  No package manager found (npm, yarn, pnpm, bun). Run install manually.");
    return false;
  }

  const choices = [
    ...available.map((pm) => ({
      name: pm,
      value: pm,
      description: `Use ${pm} to install dependencies`,
    })),
    {
      name: "Skip install",
      value: "skip" as const,
      description: "Don't install dependencies now",
    },
  ];
  const selected = await select({
    message: "Select a package manager (use ↑/↓ arrows):",
    choices,
  });

  if (selected === "skip") {
    appLogger.info("  Skipped install. Run your package manager to install dependencies.");
    return false;
  }

  appLogger.info(`  Installing dependencies with ${selected}...`);
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(selected, ["install"], {
      stdio: "inherit",
      cwd: targetDir,
    });
    child.on("exit", (code) => {
      if (code === 0) {
        appLogger.info("  Done!");
        resolvePromise();
      } else {
        reject(new Error(`${selected} install exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });

  if (selected === "bun") {
    appLogger.info("  Adding @types/bun...");
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn("bun", ["add", "-d", "@types/bun"], {
        stdio: "inherit",
        cwd: targetDir,
      });
      child.on("exit", (code) => {
        if (code === 0) {
          resolvePromise();
        } else {
          reject(new Error(`bun add @types/bun exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
  }

  return true;
}

export const createCommand = {
  name: "create",
  run: async (opts: CreateOptions = {}) => {
    try {
      await runCreate(opts);
    } catch (e) {
      if (e instanceof ExitPromptError) {
        appLogger.error(e.message);
        process.exit(130);
      }
      throw e;
    }
  },
} as const;

async function runCreate(opts: CreateOptions = {}): Promise<void> {
    const cwd = process.cwd();

    let projectName: string;
    if (opts.name === undefined) {
      const answered = await input({
        message: "Project name (leave empty to use current directory):",
        default: "",
      });
      projectName = answered.trim() === "" ? "." : answered.trim();
    } else {
      projectName = opts.name;
    }

    const targetDir = projectName === "." ? cwd : resolve(cwd, projectName);

    if (projectName !== "." && existsSync(targetDir)) {
      const entries = readdirSync(targetDir);
      if (entries.length > 0) {
        appLogger.error(`Directory "${projectName}" already exists and is not empty.`);
        process.exit(1);
      }
    }

    const packageJsonName =
      projectName === "."
        ? sanitizePackageName(basename(cwd)) || "my-reion-app"
        : sanitizePackageName(projectName);

    let templateChoice: Awaited<ReturnType<typeof resolveTemplateChoice>>;
    try {
      templateChoice = await resolveTemplateChoice(opts.template);
    } catch (e) {
      if (e instanceof ExitPromptError) throw e;
      appLogger.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    appLogger.info("reion create");
    appLogger.info(`  Target: ${targetDir}`);

    if (templateChoice.mode === "clone") {
      cloneTemplateRepo(templateChoice.url, targetDir);
      appLogger.info("  Template cloned. .git removed for a fresh project.");

      const depsInstalled = await runInstall(targetDir, opts.noInstall === true);

      appLogger.info("");
      appLogger.info("Next steps:");
      appLogger.info(`  cd ${projectName === "." ? "." : projectName}`);
      if (!depsInstalled) {
        appLogger.info("  npm install   # or: yarn / pnpm / bun install");
      }
      appLogger.info("  reion dev");
      return;
    }

    // --- default local scaffold ---
    function ensureDir(path: string) {
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }

    function write(path: string, content: string) {
      ensureDir(resolve(path, ".."));
      writeFileSync(path, content.trimStart(), "utf-8");
    }

    write(join(targetDir, "package.json"), PACKAGE_JSON(packageJsonName));
    write(join(targetDir, "tsconfig.json"), TSCONFIG_JSON);
    write(join(targetDir, "reion.config.ts"), REION_CONFIG_TS);

    const srcPath = join(targetDir, "src");
    write(join(srcPath, "router", "ping", "route.ts"), PING_ROUTE_TS);

    appLogger.info(`  Created: package.json, tsconfig.json, reion.config.ts`);
    appLogger.info(`  Created: src/router/ping/route.ts`);

    const depsInstalled = await runInstall(targetDir, opts.noInstall === true);

    appLogger.info("");
    appLogger.info("Next steps:");
    appLogger.info(`  cd ${projectName === "." ? "." : projectName}`);
    if (!depsInstalled) {
      appLogger.info("  npm install   # or: yarn / pnpm / bun install");
    }
    appLogger.info("  reion dev");
}
