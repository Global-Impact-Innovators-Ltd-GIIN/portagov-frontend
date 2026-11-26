// Local replacement for the space SDK's actionFields macro.
//
// The artifact spread field props from its action input schemas onto
// form controls (name, required, min/max length, min/max value). This
// reads the same zod schemas at runtime and produces the same props,
// so the forms in App.tsx work unchanged.

import { z } from "zod";

type FieldProps = Record<string, any>;

function unwrap(
  schema: z.ZodTypeAny,
): { inner: z.ZodTypeAny; required: boolean } {
  let current: z.ZodTypeAny = schema;
  let required = true;
  for (;;) {
    const def = (current as unknown as { _def: { typeName?: string; innerType?: z.ZodTypeAny } })._def;
    if (!def) break;
    if (def.typeName === "ZodDefault" || def.typeName === "ZodOptional") {
      required = false;
      current = def.innerType as z.ZodTypeAny;
      continue;
    }
    if (def.typeName === "ZodNullable") {
      current = def.innerType as z.ZodTypeAny;
      continue;
    }
    break;
  }
  return { inner: current, required };
}

function fieldProps(name: string, schema: z.ZodTypeAny): FieldProps {
  const { inner, required } = unwrap(schema);
  const props: FieldProps = { name };
  if (required) props.required = true;
  const def = (inner as unknown as {
    _def: {
      typeName?: string;
      checks?: { kind: string; value?: number | RegExp }[];
    };
  })._def;
  if (def?.checks) {
    for (const check of def.checks) {
      if (check.kind === "min" && typeof check.value === "number") {
        if (def.typeName === "ZodString") props.minLength = check.value;
        else props.min = check.value;
      }
      if (check.kind === "max" && typeof check.value === "number") {
        if (def.typeName === "ZodString") props.maxLength = check.value;
        else props.max = check.value;
      }
      if (check.kind === "regex" && check.value instanceof RegExp) {
        props.pattern = check.value.source;
      }
    }
  }
  // Object fields, and arrays of objects, expose their item fields
  // too, so a form can spread e.g. checklist.label and
  // checklist.greenRule the way the builder form does.
  const nested = nestedFields(inner);
  if (nested) Object.assign(props, nested);
  return props;
}

/** Field props for the members of an object schema, or for the items
    of an array of objects. Null for plain scalar fields. */
function nestedFields(
  inner: z.ZodTypeAny,
): Record<string, FieldProps> | null {
  let objectShape: Record<string, z.ZodTypeAny> | null = null;
  if (inner instanceof z.ZodObject) {
    objectShape = inner.shape as Record<string, z.ZodTypeAny>;
  } else if (inner instanceof z.ZodArray) {
    const { inner: elemInner } = unwrap(inner.element as z.ZodTypeAny);
    if (elemInner instanceof z.ZodObject) {
      objectShape = elemInner.shape as Record<string, z.ZodTypeAny>;
    }
  }
  if (!objectShape) return null;
  const out: Record<string, FieldProps> = {};
  for (const [key, fieldSchema] of Object.entries(objectShape)) {
    out[key] = fieldProps(key, fieldSchema);
  }
  return out;
}

export function actionFields(
  actions: Record<string, unknown>,
): Record<string, Record<string, FieldProps>> {
  const out: Record<string, Record<string, FieldProps>> = {};
  for (const [actionName, fn] of Object.entries(actions)) {
    const fields: Record<string, FieldProps> = {};
    const request = (fn as { request?: z.ZodTypeAny }).request;
    if (request) {
      const shape = (
        request as unknown as {
          shape?: Record<string, z.ZodTypeAny>;
        }
      ).shape;
      if (shape) {
        for (const [key, fieldSchema] of Object.entries(shape)) {
          fields[key] = fieldProps(key, fieldSchema);
        }
      }
    }
    out[actionName] = fields;
  }
  return out;
}
