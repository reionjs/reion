import fastJsonStringify from "fast-json-stringify";
import type { ResponseSchemaMap } from "../validation/routeSchema.js";
import type { SimpleSchemaShape } from "../validation/routeSchema.js";
import { cache } from "../cache/cache.js";

function isZodType(v: unknown): boolean {
  return (
    v != null &&
    typeof v === "object" &&
    "safeParse" in v &&
    typeof (v as { safeParse?: unknown }).safeParse === "function"
  );
}

function isSimpleSchemaShape(part: unknown): part is SimpleSchemaShape {
  return typeof part === "object" && part !== null && !isZodType(part);
}

type JsonSchemaObject = {
  type: "object";
  properties?: Record<string, unknown> | undefined;
  required?: string[] | undefined;
  additionalProperties?: boolean | undefined;
};

function simpleTypeToJsonSchema(value: string): { schema: Record<string, unknown>; optional: boolean } {
  const optional = value.endsWith("?");
  const type = (optional ? value.slice(0, -1) : value) as string;
  const schema: Record<string, unknown> = type === "object" || type === "array" ? { type: type as "object" | "array" } : { type };
  return { schema, optional };
}

function simpleShapeToJsonSchema(shape: SimpleSchemaShape): JsonSchemaObject {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    if (typeof value === "string") {
      const { schema, optional } = simpleTypeToJsonSchema(value);
      properties[key] = schema;
      if (!optional) required.push(key);
    } else if (typeof value === "object" && value !== null && !isZodType(value)) {
      properties[key] = simpleShapeToJsonSchema(value as SimpleSchemaShape);
      required.push(key);
    }
  }
  const out: JsonSchemaObject = {
    type: "object",
    additionalProperties: false
  };
  if (Object.keys(properties).length > 0) out.properties = properties;
  if (required.length > 0) out.required = required;
  return out;
}

function cacheKey(schema: JsonSchemaObject): string {
  return JSON.stringify(schema);
}

function getCachedSerializer(jsonSchema: JsonSchemaObject): (data: unknown) => string {
  const key = cacheKey(jsonSchema);
  let fn = cache.getFromCache("serializerCache", key) as
    | ((data: unknown) => string)
    | undefined;
  if (!fn) {
    try {
      const stringify = fastJsonStringify(jsonSchema as Parameters<typeof fastJsonStringify>[0]);
      fn = (data: unknown) => stringify(data);
      cache.setInCache("serializerCache", key, fn);
    } catch {
      fn = (data: unknown) => JSON.stringify(data);
      cache.setInCache("serializerCache", key, fn);
    }
  }
  return fn;
}

/**
 * Returns a fast serializer for the given status when the response schema is a SimpleSchemaShape.
 * Returns null when no schema or Zod schema (fall back to JSON.stringify).
 */
export function getStringifier(
  responseSchema: ResponseSchemaMap | undefined,
  status: number
): ((data: unknown) => string) | null {
  const part = responseSchema?.[status];
  if (part == null || !isSimpleSchemaShape(part)) return null;
  const cachedByIdentity = cache.getFromCache("serializerByShape", part as object) as
    | ((data: unknown) => string)
    | undefined;
  if (cachedByIdentity) return cachedByIdentity;
  const jsonSchema = simpleShapeToJsonSchema(part);
  const serializer = getCachedSerializer(jsonSchema);
  cache.setInCache("serializerByShape", part as object, serializer);
  return serializer;
}
