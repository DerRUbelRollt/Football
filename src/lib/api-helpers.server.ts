import { z } from "zod";

export function jsonResponse(
  data: unknown,
  status = 200,
  setCookies?: readonly string[],
): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  for (const cookie of setCookies ?? []) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(message: string, status = 400, details?: unknown): Response {
  return jsonResponse({ error: message, ...(details !== undefined ? { details } : {}) }, status);
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError("Invalid JSON body", 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError("Validation failed", 400, parsed.error.flatten());
  }
  return parsed.data;
}

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e.message, e.status, e.details);
    const msg = e instanceof Error ? e.message : "Internal server error";
    console.error("[api] unhandled error:", e);
    return errorResponse(msg, 500);
  }
}

export function intParam(value: string | undefined, name: string): number {
  const n = Number(value);
  if (!value || !Number.isInteger(n) || n <= 0) {
    throw new HttpError(`Ungültiger Parameter: ${name}`, 400);
  }
  return n;
}

// Reicht Session-Cookie und Bearer-Token des Trainers ans Backend weiter;
// die Validierung übernimmt das Backend.
export function forwardAuthHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const auth = request.headers.get("authorization");
  if (auth) headers.authorization = auth;
  return headers;
}
