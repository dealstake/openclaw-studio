/**
 * API route validation utilities using Zod.
 *
 * Provides `parseBody` for consistent request body parsing and error handling.
 */

import { NextResponse } from "next/server";
import type { ZodSchema, ZodError } from "zod";

/** Standard API error response shape */
export interface ApiError {
  success: false;
  error: string;
  issues?: Array<{ path: string; message: string }>;
}

/** Standard API success response shape */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Parse and validate a request body against a Zod schema.
 * Returns the parsed data or throws a formatted NextResponse error.
 *
 * @example
 * const data = await parseBody(req, mySchema);
 * // data is typed as z.infer<typeof mySchema>
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw NextResponse.json(
      { success: false, error: "Invalid JSON body" } satisfies ApiError,
      { status: 400 },
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = (result.error as ZodError).issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw NextResponse.json(
      { success: false, error: "Validation failed", issues } satisfies ApiError,
      { status: 400 },
    );
  }
  return result.data;
}

/**
 * Create a typed success response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data } satisfies ApiSuccess<T>, { status });
}

/**
 * Create a typed error response.
 */
export function apiError(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error } satisfies ApiError, { status });
}
