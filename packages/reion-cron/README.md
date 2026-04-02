# @reion/cron

Cron schedules and plugin for `reion`.

This package provides:
- A `createCronPlugin()` plugin that runs tasks from `app/cron/*.cron.ts`
- Manual task triggering via `ctx.schedule(name, payload, options?)`
- Schedule loader/runner utilities if you want low-level control

## Install

In this monorepo it is a workspace package.

For external usage:

```bash
bun add @reion/cron
```

`reion` is a peer dependency.

## Basic Usage

Add the plugin in `reion.config.ts`:

```ts
import type { ReionConfig } from "reion";
import { createCronPlugin } from "@reion/cron";

const config: ReionConfig = {
  plugins: [createCronPlugin()]
};

export default config;
```

## Disable Cron In Dev

If you want cron files to not run during `reion dev`:

```ts
plugins: [createCronPlugin({ disableDevCron: true })]
```

This only disables scheduled/background runs in dev mode. The plugin still keeps cron lookup available for manual `ctx.schedule(...)`.

## Cron File Format

Create files in `app/cron` with names ending in `.cron.ts` (or `.js`, `.mts`, `.mjs`).

Example:

```ts
import type { ScheduleDef, TaskContext } from "@reion/cron";

export const schedule: ScheduleDef = { every: "10s" };

export async function run(ctx: TaskContext) {
  console.log("cron run", ctx.payload);
}
```

Supported schedule styles:
- `{ every: "minute" }`
- `{ every: "hour" }`
- `{ every: "day", at: "09:30" }`
- `{ every: "week", day: "monday", at: "10:00" }`
- `{ every: "month", date: 1, at: "00:00" }`
- `{ every: "10s" }`, `{ every: "5m" }`, `{ every: "2h" }`, etc.

## Manual Trigger From Request Context

The plugin augments `ReionContext` with:

```ts
ctx.schedule(name, payload?, { delayMs?, at? })
```

Example:

```ts
await ctx.schedule("interval.example", { source: "api" }, { delayMs: 2000 });
```

`at` accepts:
- `Date`
- epoch milliseconds (`number`)
- Date-parsable string

## Exports

Top-level exports include:
- `createCronPlugin`
- `ScheduleDef`, `Schedule`, `TaskContext`, `TaskRunFn`, `LoadedTask`
- `loadSchedulesFromApp`, `scanScheduleFiles`, `createScheduleRunner`, `runScheduler`, and related helpers

