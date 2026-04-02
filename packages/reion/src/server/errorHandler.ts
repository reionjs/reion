import type { ErrorHandlerResult } from "../config/loadConfig";
import type { ReionContext } from "../core/context";

export function defaultErrorHandler(
  { logger }: ReionContext,
  err?: unknown,
): ErrorHandlerResult {
  if (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = (err as { status?: number }).status ?? 500;
    logger.error(err);
    return { status, json: { error: message } };
  }
  return { status: 500, json: { error: "Internal Server Error" } };
}
