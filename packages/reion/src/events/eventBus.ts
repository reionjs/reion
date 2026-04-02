import type { ReionLogger } from "../logger/requestLogger.js";
import { getBaseLogger } from "../logger/requestLogger.js";

export type EventEmitterFn = (name: string, payload?: unknown) => void;

/**
 * Fields forwarded when emitting so handlers inherit trace + logging
 * (from `ctx.emit` on a route or from `eventCtx.emit` inside another handler).
 */
export type EventEmitSource = {
  traceId: string;
  logger: ReionLogger;
  eventName: string;
};

export type EventContext = EventEmitSource & {
  /** Value passed to `emit(name, payload)` for this event. */
  payload: unknown;
  /** Emit another event; keeps the same `traceId` and `logger` as this context. */
  emit: EventEmitterFn;
};

/** Receives a single `EventContext` (`ctx.payload`, `ctx.emit`, …). */
export type EventHandler = (ctx: EventContext) => void | Promise<void>;

export type EventBus = {
  on: (name: string, handler: EventHandler) => void;
  /**
   * Dispatch an event. Pass `source` when emitting from a request (`ctx.emit`) or omit it for ad-hoc emits.
   * Handlers receive a full `EventContext` including `payload` and `emit` for chaining.
   */
  emit: (name: string, payload?: unknown, source?: EventEmitSource) => void;
};

function defaultEmitSource(eventName: string): EventEmitSource {
  return {
    traceId: "",
    logger: getBaseLogger().child({ eventName }),
    eventName,
  };
}

export function createEventBus(): EventBus {
  const handlers = new Map<string, EventHandler[]>();

  const bus: EventBus = {
    on: (name, handler) => {
      const list = handlers.get(name) ?? [];
      list.push(handler);
      handlers.set(name, list);
    },
    emit: (name, payload, source) => {
      const list = handlers.get(name) ?? [];
      if (list.length === 0) {
        console.warn(`[Event] event not found: "${name}"`);
        return;
      }
      const base = source ?? defaultEmitSource(name);
      const merged: EventEmitSource = {
        traceId: base.traceId,
        logger: base.logger,
        eventName: name,
      };
      const ctx: EventContext = {
        ...merged,
        payload,
        emit: (childName, childPayload) => {
          bus.emit(childName, childPayload, {
            traceId: merged.traceId,
            logger: merged.logger,
            eventName: childName,
          });
        },
      };
      for (const handler of list) {
        try {
          const result = handler(ctx);
          if (result != null && typeof (result as PromiseLike<void>).then === "function") {
            void Promise.resolve(result).catch((err: unknown) => {
              ctx.logger.error(
                { err, event: name },
                "reion event handler rejected",
              );
            });
          }
        } catch (err) {
          ctx.logger.error({ err, event: name }, "reion event handler threw");
        }
      }
    },
  };

  return bus;
}
