import { z } from "zod";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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

export async function requireTrainerUser(request: Request): Promise<{ userId: string; email: string | null }> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    throw new HttpError("Unauthorized", 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new HttpError("Unauthorized", 401);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new HttpError("Unauthorized", 401);
  return { userId: data.user.id, email: data.user.email ?? null };
}
