export const lifecycleStages = [
  "requestReceived",
  "createContext",
  "traceStart",
  "globalMiddleware",
  "routeMatch",
  "routeMiddleware",
  "handler",
  "emitEvents",
  "responseTransform",
  "sendResponse",
  "traceEnd"
] as const;

export type LifecycleStage = (typeof lifecycleStages)[number];

