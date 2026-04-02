# Legonode

A file-based API framework for Node.js and Bun. Define routes as files under an app directory, add middleware, and run with hot reload in development or a built server in production.

## Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- **TypeScript** (recommended)

## Quick start

This scaffolds a minimal project and starts the dev server (default: http://127.0.0.1:3000).

### Add to an existing project

```bash
npm install legonode
# or: bun add legonode
# or: yarn add legonode
```

Add a **`router/`** tree under your app directory (see [Project structure](#project-structure)) and a `reion.config.ts`.

## CLI

| Command | Description |
|--------|-------------|
| `reion dev` | Run the app with hot reload. |
| `reion build` | Build for production (output in `./dist` by default). |
| `reion start` | Run the built app (no hot reload). |

**Options (common)**

- `-p, --port <number>` — Port (default: 3000).
- `-H, --host <string>` — Hostname (default: 127.0.0.1).
- `--appDir <path>` — App root directory (overrides config). Routes are read from `{appDir}/router/**`.
- `--build-path <path>` — Build output directory (for `build` / `start`).

## Project structure

A minimal project:

```
my-api/
├── src/
│   ├── router/                 ← all HTTP routes live here
│   │   └── api/
│   │       └── hello/
│   │           └── route.ts    → GET /api/hello
│   ├── events/                 ← optional: *.event.ts
│   └── cron/                   ← optional: *.cron.ts
├── legonode.config.ts
├── package.json
└── tsconfig.json
```

- **`appDir`** (config, default **`./src`**) — Project root for Legonode: **`router/`** (routes + `router/**/middleware.ts`), **`events/`**, **`cron/`**.
- **`reion.config.ts`** — Optional: port, host, CORS, logging, dev options, plugins.

**Migration from older layouts:** If you used `appDir: "./src/app"` with routes under `src/app/api/...`, move them to `src/router/api/...` and set `appDir` to `./src` (or keep a single app root and use `router/` next to your other folders).

## Your first route

Create `src/router/route.ts` (root URL `/`):

```ts
import type { Context } from "reion";

export async function GET(ctx: Context) {
  ctx.res.status(200);
  return { message: "Hello from Legonode" };
}
```

Add `src/router/api/hello/route.ts` for `GET /api/hello`:

```ts
import type { Context } from "reion";

export async function GET(ctx: Context) {
  ctx.res.status(200);
  return { hello: "world" };
}
```

Export `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc. from a `route.ts` file (or method-specific files like `get.ts`) to handle those methods on the path that matches the file location under **`router/`**.

## Config

Example `reion.config.ts`:

```ts
import type { LegonodeConfig } from "reion";

const config: LegonodeConfig = {
  appDir: "./src", // default
  port: 3000,
  dev: {
    logPretty: true,
  },
};

export default config;
```

## License

See the repository for license information.
