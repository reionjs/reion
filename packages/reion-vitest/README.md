# @reionjs/vitest

Vitest helpers for [Reion](https://github.com/reionjs/reion): boot a real HTTP server from `reion.config.*`, inject a small `request` client into tests, and tear down automatically.

## Install

```bash
bun add -d vitest @reionjs/vitest
```

Peer dependencies: `reion`, `vitest`.

## Setup with CLI

Use Reion CLI for automatic setup:

```bash
reion add -p @reionjs/vitest
```

This setup does:

- installs `@reionjs/vitest` (handled by `reion add`)
- installs `vitest` (unless you use `--skip-install`)
- creates `vitest.config.ts` if it does not exist
- sets `package.json` script: `"test": "vitest run"`

When creating `vitest.config.ts`, setup prompts whether to add alias config:

- optional `@` alias (`@` -> `./src`) for projects using tsconfig paths

If `vitest.config.ts` already exists, setup leaves it unchanged.

## Usage

```ts
import { describe, it, expect } from "@reionjs/vitest";

describe("API", () => {
  it("GET /api/hello", async ({ request }) => {
    const res = await request.get("/api/hello");
    expect(res.status).toBe(200);
  });
});
```

- Use **`describe` / `it` from this package** (not plain `vitest`) so the suite gets a Reion server from `process.cwd()` + `reion.config.*`.
- For custom setups, use **`createTestServer()`** and **`createRequestClient()`** directly.

See the docs: **Plugins → Vitest helpers**.

## Development

```bash
bun run build
bun run test
```
