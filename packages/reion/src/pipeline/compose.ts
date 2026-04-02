import type { ReionContext } from "../core/context.js";
import type { Middleware } from "../middleware/middlewareRunner.js";

export type PipelineHandler = (ctx: ReionContext) => unknown | Promise<unknown>;

/** True if value is thenable (has .then). */
function isThenable(v: unknown): v is Promise<unknown> {
  return v != null && typeof (v as Promise<unknown>).then === "function";
}

/**
 * Compose middleware + handler into a single pipeline function (no loop at request time).
 * Builds a chain: mw1(ctx, () => mw2(ctx, () => ... () => handler(ctx))).
 * Returns sync when handler (and chain) returns sync to avoid extra microtasks.
 */
export function compose(
  middleware: Middleware[],
  handler: PipelineHandler,
): (ctx: ReionContext) => unknown | Promise<unknown> {
  if (middleware.length === 0) {
    return (ctx: ReionContext) => handler(ctx);
  }
  const len = middleware.length;
  return (ctx: ReionContext): unknown | Promise<unknown> => {
    let index = -1;
    const dispatch = (i: number): unknown | Promise<unknown> => {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"));
      index = i;
      if (i === len) return handler(ctx);
      const mw = middleware[i]!;
      return mw(ctx, (err?: unknown): Promise<void> => {
        if (err !== undefined && err !== null) return Promise.reject(err);
        const nextRet = dispatch(i + 1);
        return isThenable(nextRet)
          ? (nextRet as Promise<unknown>).then(() => undefined)
          : Promise.resolve();
      });
    };
    return dispatch(0);
  };
}
