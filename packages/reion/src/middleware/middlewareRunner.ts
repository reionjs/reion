import type { ReionContext } from "../core/context.js";

export type Next = (err?: unknown) => Promise<void>;
export type Middleware = (ctx: ReionContext, next: Next) => Promise<void> | void;

/** Thrown when middleware calls next(err); request handler catches and passes to errorHandler */
export class NextError extends Error {
  constructor(public readonly error: unknown) {
    super("next(err) called");
    this.name = "NextError";
  }
}

export async function runMiddlewareStack(ctx: ReionContext, middleware: Middleware[], handler: () => Promise<void>) {
  let idx = -1;

  async function dispatch(i: number): Promise<void> {
    if (i <= idx) throw new Error("next() called multiple times");
    idx = i;
    const fn: Middleware | undefined = middleware[i];
    if (!fn) return handler();
    await fn(ctx, (err?: unknown) => {
      if (err !== undefined && err !== null) throw new NextError(err);
      return dispatch(i + 1);
    });
  }

  await dispatch(0);
}

