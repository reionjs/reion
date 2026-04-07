import * as vitest from "vitest";
import { createTestServer, type TestServer } from "./boot.js";
import { createRequestClient, type ReionRequestClient } from "./request.js";

export type ReionTestContext = {
  request: ReionRequestClient;
  baseUrl: string;
  /** The running test server (close via `server.close()` or suite teardown). */
  server: TestServer;
};

type SuiteSlot = {
  server: TestServer | null;
};

const suiteStack: SuiteSlot[] = [];

const sequential = vitest.describe.sequential;

function makeSuite(fn: () => void): void {
  const slot: SuiteSlot = { server: null };
  suiteStack.push(slot);
  vitest.beforeAll(async () => {
    slot.server = await createTestServer({ cwd: process.cwd() });
  });
  vitest.afterAll(async () => {
    if (slot.server) await slot.server.close();
    suiteStack.pop();
  });
  fn();
}

function getCurrentServer(): TestServer {
  const slot = suiteStack[suiteStack.length - 1];
  const server = slot?.server;
  if (!server) {
    throw new Error(
      "No Reion test server in context. Use `describe` from `@reionjs/vitest`, or call `createTestServer()` yourself.",
    );
  }
  return server;
}

function runItCallback(
  fn: (ctx: ReionTestContext) => void | Promise<void>,
) {
  const s = getCurrentServer();
  const request = createRequestClient(s.baseUrl);
  return fn({ request, baseUrl: s.baseUrl, server: s });
}

type ReionTestFn = (ctx: ReionTestContext) => void | Promise<void>;

function defineDescribe(
  seq: typeof sequential,
) {
  return (name: string, fn: () => void) => {
    return seq(name, () => makeSuite(fn));
  };
}

const describeBase = defineDescribe(sequential);
const describeOnly = defineDescribe(sequential.only);
const describeSkip = defineDescribe(sequential.skip);

/**
 * Like Vitest `describe`, but starts a Reion HTTP server from the root `reion.config.*` (via `process.cwd()`)
 * before tests in this suite run, and closes it after. Uses sequential suites so lifecycle stays ordered.
 */
export const describe = Object.assign(describeBase, {
  only: describeOnly,
  skip: describeSkip,
});

function itCore(
  name: string,
  fn: ReionTestFn,
  timeout?: number,
): ReturnType<typeof vitest.it> {
  return vitest.it(name, () => runItCallback(fn), timeout);
}

const itOnly = (
  name: string,
  fn: ReionTestFn,
  timeout?: number,
): ReturnType<typeof vitest.it> => vitest.it.only(name, () => runItCallback(fn), timeout);

const itSkip = (
  name: string,
  fn: ReionTestFn,
  timeout?: number,
): ReturnType<typeof vitest.it> => vitest.it.skip(name, () => runItCallback(fn), timeout);

/**
 * Like Vitest `it`, but the callback receives `{ request, baseUrl, server }` for the suite’s Reion server.
 */
export const it = Object.assign(itCore, {
  only: itOnly,
  skip: itSkip,
});
