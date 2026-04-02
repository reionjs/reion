import type { ReionContext } from "../core/context.js";

/**
 * Validate ctx.body with a parse function (e.g. Zod schema's .parse).
 * Returns the parsed value on success; throws on failure (error handler can send 400).
 */
export function validateBody<T>(ctx: ReionContext, parse: (body: unknown) => T): T {
  return parse(ctx.body);
}
