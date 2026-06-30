import { validationFailed } from "./errors";

import type { NextRequest } from "next/server";
import type { z } from "zod";

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw validationFailed({ body: ["Request body must be valid JSON."] });
  }

  return parseWithSchema(body, schema);
}

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: TSchema,
): z.infer<TSchema> {
  return parseWithSchema(Object.fromEntries(request.nextUrl.searchParams.entries()), schema);
}

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  value: unknown,
  schema: TSchema,
): z.infer<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw validationFailed(parsed.error.flatten());
  }
  const data = parsed.data as z.infer<TSchema>;
  return data;
}

export function sanitizeString(value: string): string {
  return value.trim().replace(/\p{C}/gu, "");
}
