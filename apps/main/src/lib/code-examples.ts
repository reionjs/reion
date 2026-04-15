import { Code2, GitBranch, Play, Radio, SquareTerminal } from "lucide-react";

const exampleRoute = {
  ts: `import type { Context } from "reion";
import { z } from "reion";

export const schema = {
  body: z.object({
    name: z.string().min(2),
    email: z.string().email()
  })
};

export async function POST(ctx: Context) {
  const user = await createUser(ctx.body);
  return ctx.res.status(201).json({ user });
}`,
  js: `import { z } from "reion";

export const schema = {
  body: z.object({
    name: z.string().min(2),
    email: z.string().email()
  })
};

export async function POST(ctx) {
  const user = await createUser(ctx.body);
  return ctx.res.status(201).json({ user });
}`,
};

const exampleConfig = {
  ts: `import type { ReionConfig } from "reion";
import { createCronPlugin } from "@reionjs/cron";
import { createMetricsPlugin } from "./src/plugins/plugin";

const config: ReionConfig = {
  plugins: [createCronPlugin(), createMetricsPlugin()]
};

export default config;`,
  js: `import { createCronPlugin } from "@reionjs/cron";
import { createMetricsPlugin } from "./src/plugins/plugin";

const config = {
  plugins: [createCronPlugin(), createMetricsPlugin()]
};

export default config;`,
};

const exampleMiddleware = {
  ts: `import type { Middleware } from "reion";

export const middleware: Middleware = async (ctx, next) => {
  const startedAt = Date.now();
  ctx.state.requestId = crypto.randomUUID();
  await next();
  ctx.logger.info({
    requestId: ctx.state.requestId,
    durationMs: Date.now() - startedAt
  });
};`,
  js: `export const middleware = async (ctx, next) => {
  const startedAt = Date.now();
  ctx.state.requestId = crypto.randomUUID();
  await next();
  ctx.logger.info({
    requestId: ctx.state.requestId,
    durationMs: Date.now() - startedAt
  });
};`,
};

const exampleCron = {
  ts: `import type { ScheduleDef, TaskContext } from "@reionjs/cron";

export const schedule: ScheduleDef = {
  every: "day",
  at: "02:30"
};

export async function run(ctx: TaskContext) {
  await generateDailyMetrics(ctx.payload);
}`,
  js: `export const schedule = {
  every: "day",
  at: "02:30"
};

export async function run(ctx) {
  await generateDailyMetrics(ctx.payload);
}`,
};

const exampleSecurity = {
  ts: `import type { SecurityConfig } from "reion";

export const security: SecurityConfig = {
  headers: { enabled: true },
  rateLimit: { enabled: true, windowMs: 60_000, max: 100 },
  requestSize: { enabled: true, maxBodySize: 1_000_000 },
  ipFilter: { enabled: true, allow: ["127.0.0.1", "::1"], trustProxy: true },
  csrf: { enabled: true },
  timeout: { enabled: true, timeoutMs: 15_000 },
};`,
  js: `export const security = {
  headers: { enabled: true },
  rateLimit: { enabled: true, windowMs: 60_000, max: 100 },
  requestSize: { enabled: true, maxBodySize: 1_000_000 },
  ipFilter: { enabled: true, allow: ["127.0.0.1", "::1"], trustProxy: true },
  csrf: { enabled: true },
  timeout: { enabled: true, timeoutMs: 15_000 },
};`,
};

const examplePluginFile = {
  ts: `import type { ReionPlugin } from "reion";

export function createMetricsPlugin(): ReionPlugin {
  return {
    name: "metrics",
    onRequest: async (ctx) => {
      const startedAt = Date.now();
      ctx.logger.info({ type: "request:start", path: ctx.req.path });

      ctx.onFinish(() => {
        ctx.logger.info({
          type: "request:finish",
          durationMs: Date.now() - startedAt
        });
      });
    }
  };
}`,
  js: `export function createMetricsPlugin() {
  return {
    name: "metrics",
    onRequest: async (ctx) => {
      const startedAt = Date.now();
      ctx.logger.info({ type: "request:start", path: ctx.req.path });
}`,
};

export type CodeFileTab = {
  id: string;
  labelTs: string;
  labelJs: string;
  fileNameTs: string;
  fileNameJs: string;
  code: { ts: string; js: string };
  highlightMeta: string;
};

export const PROJECT_TABS = [
  {
    id: "routing",
    label: "Routing",
    icon: SquareTerminal,
    title: "Routing - File based endpoints",
    description:
      "Define handlers by file path and HTTP method. Reion maps routes from your folder structure so APIs stay easy to navigate.",
    hint: "Start with small route modules, then split by domain folders as the API grows.",
    codeFiles: [
      {
        id: "routing-file",
        labelTs: "src/router/users/route.ts",
        labelJs: "src/router/users/route.js",
        fileNameTs: "src/router/users/route.ts",
        fileNameJs: "src/router/users/route.js",
        code: exampleRoute,
        highlightMeta: "{13-17}",
      },
    ],
  },
  {
    id: "middleware",
    label: "Middleware",
    icon: GitBranch,
    title: "Middleware - Shared request logic",
    description:
      "Compose reusable logic for auth, logging, and request shaping. Middleware can run at app, group, or route levels.",
    hint: "Keep middleware focused: one concern per file (auth, telemetry, validation).",
    codeFiles: [
      {
        id: "middleware-file",
        labelTs: "src/router/middleware.ts",
        labelJs: "src/router/middleware.js",
        fileNameTs: "src/router/middleware.ts",
        fileNameJs: "src/router/middleware.js",
        code: exampleMiddleware,
        highlightMeta: "{4-8}",
      },
    ],
  },
  {
    id: "cron",
    label: "Cron",
    icon: Play,
    title: "Cron - Scheduled background jobs",
    description:
      "Run recurring jobs from typed cron files and trigger them manually from route handlers when needed.",
    hint: "Design cron jobs to be idempotent so retries are safe in production.",
    codeFiles: [
      {
        id: "cron-file",
        labelTs: "src/cron/report.cron.ts",
        labelJs: "src/cron/report.cron.js",
        fileNameTs: "src/cron/report.cron.ts",
        fileNameJs: "src/cron/report.cron.js",
        code: exampleCron,
        highlightMeta: "{7-9}",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: Radio,
    title: "Security - Production defaults",
    description:
      "Configure rate limiting, security headers, and other controls from one place while preserving route-level flexibility.",
    hint: "Enable baseline security globally, then tune per environment with config overrides.",
    codeFiles: [
      {
        id: "security-file",
        labelTs: "src/security/security.ts",
        labelJs: "src/security/security.js",
        fileNameTs: "src/security/security.ts",
        fileNameJs: "src/security/security.js",
        code: exampleSecurity,
        highlightMeta: "{3-16}",
      },
    ],
  },
  {
    id: "plugins",
    label: "Plugins",
    icon: Code2,
    title: "Plugins - Extend runtime behavior",
    description:
      "Compose cron, auth, and custom plugins with consistent lifecycle hooks to keep integrations predictable.",
    hint: "Treat plugins like modules: explicit contracts, minimal side effects.",
    codeFiles: [
      {
        id: "plugins-config",
        labelTs: "reion.config.ts",
        labelJs: "reion.config.js",
        fileNameTs: "reion.config.ts",
        fileNameJs: "reion.config.js",
        code: exampleConfig,
        highlightMeta: "{4}",
      },
      {
        id: "plugins-file",
        labelTs: "src/plugins/plugin.ts",
        labelJs: "src/plugins/plugin.js",
        fileNameTs: "src/plugins/plugin.ts",
        fileNameJs: "src/plugins/plugin.js",
        code: examplePluginFile,
        highlightMeta: "{8-15}",
      },
    ],
  },
] as const;
