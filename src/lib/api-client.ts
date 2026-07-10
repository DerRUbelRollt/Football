import { getSessionTokens } from "./session";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface ApiFetchOptions {
  method?: Method;
  body?: unknown;
  auth?: boolean; // attach trainer bearer token
  query?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, query } = opts;

  let url = path.startsWith("/") ? path : `/${path}`;
  if (query) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const s = getSessionTokens();
    const token = s.access_token ?? null;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }
  }

  if (!res.ok) {
    const err = (parsed && typeof parsed === "object" && "error" in parsed
      ? (parsed as { error: string }).error
      : `Request failed (${res.status})`) as string;
    throw new ApiError(err, res.status, parsed);
  }

  return parsed as T;
}

// ---------- Typed wrappers ----------

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthResponse {
  session: AuthSession;
  user: AuthUser;
}

export interface PlayerSummary {
  id: string;
  first_name: string;
  last_name: string;
  player_code: string;
  group_id: string;
  groups: { name: string } | null;
}

export interface PlayerOverview {
  player: PlayerSummary;
  upcoming: any[];
  history: any[];
}

export const api = {
  auth: {
    login: (body: { email: string; password: string }) =>
      apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body }),
    signup: (body: { email: string; password: string; displayName?: string }) =>
      apiFetch<AuthResponse>("/api/auth/signup", { method: "POST", body }),
    verify: (token: string) =>
      apiFetch<{ userId: string; email: string | null }>("/api/auth/verify", {
        method: "POST",
        body: { token },
      }),
  },
  player: {
    login: (body: { code: string }) =>
      apiFetch<{ player: PlayerSummary }>("/api/player/login", { method: "POST", body }),
    overview: (body: { code: string }) =>
      apiFetch<PlayerOverview>("/api/player/overview", { method: "POST", body }),
    setAttendance: (body: { code: string; eventId: string; status: "accepted" | "declined" | "pending" }) =>
      apiFetch<{ ok: true }>("/api/player/attendance", { method: "POST", body }),
  },
};
