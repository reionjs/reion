# Reion

A file-based API framework for Node.js and Bun. Define routes as files under an router directory, add middleware, and run with hot reload in development or a built server in production.

## Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- **TypeScript** (recommended)

## Quick start


This scaffolds a minimal project and starts the dev server (default: http://127.0.0.1:3000).

### Add to an existing project

```bash
npm install reion
# or: bun add reion
# or: yarn add reion
```

Add a **`router/`** directory under your app root (e.g. `./src/router` when `appDir` is `./src`, or `./router` when `appDir` is `./`). See [Project structure](#project-structure) below.

## CLI

| Command | Description |
|--------|-------------|
| `reion dev` | Run the app with hot reload. |
| `reion build` | Build for production (output in `./dist` by default). |
| `reion start` | Run the built app (no hot reload). |

**Options (common)**

- `-p, --port <number>` — Port (default: 3000).
- `-H, --host <string>` — Hostname (default: 127.0.0.1).
- `--appDir <path>` — App root (overrides config). Routes are loaded from `{appDir}/router/**`.
- `--build-path <path>` — Build output directory (for `build` / `start`).

## Project structure

A minimal project:

```
my-api/
├── src/
│   └── router/
│       └── api/
│           └── hello/
│               └── route.ts   → GET /api/hello
├── reion.config.ts
├── package.json
└── tsconfig.json
```

- **App directory** (`appDir` in config, default `./src`) — Routes live under `router/`, and middleware lives under `router/**/middleware.ts`. File paths under `router/` map to URL paths.
- **`reion.config.ts`** — Optional: port, host, CORS, logging, dev options, plugins.

## Your first route

Create `src/router/route.ts` (or `router/route.ts` if using `appDir: "./"`):

```ts
import type { Context } from "reion";

export async function GET(ctx: Context) {
  ctx.res.status(200);
  return { message: "Hello from Reion" };
}
```

This handles `GET /` and returns JSON.

Add `src/router/api/hello/route.ts` for `GET /api/hello`:

```ts
import type { Context } from "reion";

export async function GET(ctx: Context) {
  ctx.res.status(200);
  return { hello: "world" };
}
```

Export `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc. from a `route.ts` file to handle those methods on the path that matches the file location.

## Config

Example `reion.config.ts`:

```ts
import type { ReionConfig } from "reion";

const config: ReionConfig = {
  appDir: "./src", // option default ./src
  port: 3000,
  dev: {
    logPretty: true,
  },
};

export default config;
```

## License

See the repository for license information.
