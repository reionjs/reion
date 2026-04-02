import { z } from "zod";

/** Simple type descriptor. Add "?" for optional: "string?", "number?", "boolean?" */
export type SimpleType = "string" | "number" | "boolean" | "object" | "array";

/** Shape for body, params, or query: field name -> simple type string or nested object. */
export interface SimpleSchemaShape {
  [key: string]: SimpleType | string | SimpleSchemaShape;
}

/** Per-key schema: either a simple shape (converted to Zod) or a Zod schema. */
export type SchemaPart = SimpleSchemaShape | z.ZodTypeAny;

/** Route schema: validate body (only for methods that send body), params, query. */
export type RouteSchema = {
  body?: SchemaPart;
  params?: SchemaPart;
  query?: SchemaPart;
};

/** Per-method overrides. Merged on top of SCHEMA for the current method. */
export type MethodSchemaMap = Partial<Record<string, RouteSchema>>;

/** Response body schema per status code. Enforced before sending so only allowed shapes are sent. */
export type ResponseSchemaMap = Partial<Record<number, SchemaPart>>;

/** Infer TypeScript type from a simple shape (e.g. { id: "string", name: "string" } -> { id: string; name: string }). */
export type InferSimpleShape<T> = T extends Record<string, SimpleType | string | SimpleSchemaShape>
  ? { [K in keyof T]: InferSimpleValue<T[K]> }
  : never;

/** Map simple type strings to TS types. Supports "string?", "number?", etc. */
export type InferSimpleValue<V> = V extends "string"
  ? string
  : V extends "number"
    ? number
    : V extends "boolean"
      ? boolean
      : V extends "object"
        ? object
        : V extends "array"
          ? unknown[]
          : V extends "string?"
            ? string | undefined
            : V extends "number?"
              ? number | undefined
              : V extends "boolean?"
                ? boolean | undefined
                : V extends "object?"
                  ? object | undefined
                  : V extends "array?"
                    ? unknown[] | undefined
                    : V extends SimpleSchemaShape
                      ? InferSimpleShape<V>
                      : unknown;

/** Infer response body types from a response schema map (Zod or simple shapes) for use with Context<T>. */
export type InferResponseBodies<S extends ResponseSchemaMap> = {
  [K in keyof S]: S[K] extends z.ZodTypeAny
    ? z.infer<S[K]>
    : S[K] extends SimpleSchemaShape
      ? InferSimpleShape<S[K]>
      : unknown;
};

/** Merge local route response schema with default (config) schema. Local overrides default for same status. */
export type MergedResponseBodies<
  Local extends ResponseSchemaMap,
  Default extends ResponseSchemaMap = Record<number, never>,
> = Omit<InferResponseBodies<Default>, keyof Local> & InferResponseBodies<Local>;

export type ResponseValidationResult =
  | { ok: true }
  | { ok: false; details: unknown };

export type CompiledRouteValidators = {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

/** Validate response body against a schema (e.g. from config.responses[200] or GET_RESPONSE_SCHEMA[201]). */
export function validateResponseBody(schema: SchemaPart, data: unknown): ResponseValidationResult {
  const zodSchema = toZodSchema(schema);
  const parsed = zodSchema.safeParse(data);
  if (parsed.success) return { ok: true };
  return { ok: false, details: parsed.error.flatten() };
}

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function isZodType(v: unknown): v is z.ZodTypeAny {
  return v != null && typeof v === "object" && "safeParse" in v && typeof (v as z.ZodTypeAny).safeParse === "function";
}

function parseSimpleType(s: string): { type: SimpleType; optional: boolean } {
  const optional = s.endsWith("?");
  const type = (optional ? s.slice(0, -1) : s) as SimpleType;
  return { type, optional };
}

function simpleToZod(value: SimpleType | string | SimpleSchemaShape): z.ZodTypeAny {
  if (typeof value === "string") {
    const { type, optional } = parseSimpleType(value);
    let schema: z.ZodTypeAny;
    switch (type) {
      case "string":
        schema = z.string();
        break;
      case "number":
        schema = z.coerce.number();
        break;
      case "boolean":
        schema = z.coerce.boolean();
        break;
      case "object":
        schema = z.record(z.unknown());
        break;
      case "array":
        schema = z.array(z.unknown());
        break;
      default:
        schema = z.unknown();
    }
    return optional ? schema.optional() : schema;
  }
  if (typeof value === "object" && value !== null && !isZodType(value)) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(value)) {
      shape[k] = simpleToZod(v as SimpleType | string | SimpleSchemaShape);
    }
    return z.object(shape);
  }
  return z.unknown();
}

function toZodSchema(part: SchemaPart): z.ZodTypeAny {
  if (isZodType(part)) return part;
  return simpleToZod(part as SimpleSchemaShape);
}

/** Merge method overrides onto base. Method schema wins for each key (body, params, query). */
export function mergeRouteSchema(base: RouteSchema | undefined, methodOverride: RouteSchema | undefined): RouteSchema {
  if (!methodOverride) return base ?? {};
  if (!base) return methodOverride;
  const body = methodOverride.body ?? base.body;
  const params = methodOverride.params ?? base.params;
  const query = methodOverride.query ?? base.query;
  const out: RouteSchema = {};
  if (body !== undefined) out.body = body;
  if (params !== undefined) out.params = params;
  if (query !== undefined) out.query = query;
  return out;
}

export type ValidationResult =
  | { ok: true; body?: unknown; params?: Record<string, string | string[]>; query?: Record<string, string> }
  | { ok: false; status: number; json: { error: string; details?: unknown } };

/** Thrown when route validation fails; request handler sends status + json. */
export class ValidationError extends Error {
  constructor(
    public readonly status: number,
    public readonly json: { error: string; details?: unknown }
  ) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

/**
 * Validate ctx against the merged route schema.
 * Body is only validated when method is POST, PUT, or PATCH.
 */
export function validateRoute(
  schema: RouteSchema,
  method: string,
  ctx: { body: unknown; params: Record<string, string | string[]>; query: Record<string, string> }
): ValidationResult {
  const validateBody = BODY_METHODS.has(method);
  const result: ValidationResult = { ok: true };
  const queryObj = ctx.query;

  if (schema.body && validateBody) {
    const bodySchema = toZodSchema(schema.body);
    const parsed = bodySchema.safeParse(ctx.body);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        json: { error: "Validation failed", details: parsed.error.flatten() }
      };
    }
    (result as { body?: unknown }).body = parsed.data;
  }

  if (schema.params) {
    const paramsSchema = toZodSchema(schema.params);
    const parsed = paramsSchema.safeParse(ctx.params);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        json: { error: "Invalid params", details: parsed.error.flatten() }
      };
    }
    (result as { params?: Record<string, string | string[]> }).params = parsed.data as Record<string, string | string[]>;
  }

  if (schema.query) {
    const querySchema = toZodSchema(schema.query);
    const parsed = querySchema.safeParse(queryObj);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        json: { error: "Invalid query", details: parsed.error.flatten() }
      };
    }
    (result as { query?: Record<string, string> }).query = parsed.data as Record<string, string>;
  }

  return result;
}

export function compileRouteValidators(schema: RouteSchema): CompiledRouteValidators {
  const out: CompiledRouteValidators = {};
  if (schema.body) out.body = toZodSchema(schema.body);
  if (schema.params) out.params = toZodSchema(schema.params);
  if (schema.query) out.query = toZodSchema(schema.query);
  return out;
}

export function validateRouteWithCompiled(
  validators: CompiledRouteValidators,
  method: string,
  ctx: { body: unknown; params: Record<string, string | string[]>; query: Record<string, string> }
): ValidationResult {
  const validateBody = BODY_METHODS.has(method);
  const result: ValidationResult = { ok: true };

  if (validators.body && validateBody) {
    const parsed = validators.body.safeParse(ctx.body);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        json: { error: "Validation failed", details: parsed.error.flatten() }
      };
    }
    (result as { body?: unknown }).body = parsed.data;
  }

  if (validators.params) {
    const parsed = validators.params.safeParse(ctx.params);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        json: { error: "Invalid params", details: parsed.error.flatten() }
      };
    }
    (result as { params?: Record<string, string | string[]> }).params = parsed.data as Record<string, string | string[]>;
  }

  if (validators.query) {
    const parsed = validators.query.safeParse(ctx.query);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        json: { error: "Invalid query", details: parsed.error.flatten() }
      };
    }
    (result as { query?: Record<string, string> }).query = parsed.data as Record<string, string>;
  }

  return result;
}

export { z };
