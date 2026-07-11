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
    const token = s?.access_token ?? null;
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
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
  group_id: number;
  groups: { name: string }[];
}

export interface PlayerOverview {
  player: PlayerSummary;
  upcoming: any[];
  history: any[];
}

export type AttendanceStatus = "accepted" | "declined" | "pending";

export interface GroupSummary {
  id: number;
  name: string;
  description: string | null;
  player_count: number;
}

export interface GroupDetail {
  id: number;
  name: string;
  description: string | null;
}

export interface PlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
  group_id: number;
}

export interface ExistingPlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
}

export interface EventListItem {
  id: number;
  event_type: "training" | "game";
  title: string;
  opponent: string | null;
  home_away: "home" | "away" | null;
  location: string | null;
  event_at: string;
  groups: { name: string } | null;
}

export interface EventDetail extends EventListItem {
  meeting_point: string | null;
  description: string | null;
  group_id: number;
}

export interface NewEvent {
  eventType: "training" | "game";
  title: string;
  opponent: string | null;
  homeAway: "home" | "away" | null;
  location: string | null;
  meetingPoint: string | null;
  eventAt: string;
  description: string | null;
  groupId: number;
}

export interface EventAttendanceRow {
  id: number;
  status: AttendanceStatus;
  players: {
    id: number;
    first_name: string;
    last_name: string;
    player_code: string;
  } | null;
}

export interface DashboardStats {
  groups: number;
  players: number;
  upcoming: EventListItem[];
  rate: number;
}

export interface StatsAttendanceRow {
  status: AttendanceStatus;
  players: { id: number; first_name: string; last_name: string } | null;
  events: { event_at: string } | null;
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
    setAttendance: (body: { code: string; eventId: number; status: AttendanceStatus }) =>
      apiFetch<{ ok: true }>("/api/player/attendance", { method: "POST", body }),
  },
  groups: {
    list: () => apiFetch<GroupSummary[]>("/api/groups", { auth: true }),
    create: (body: { name: string; description: string | null }) =>
      apiFetch<GroupDetail>("/api/groups", { method: "POST", body, auth: true }),
    get: (groupId: string | number) =>
      apiFetch<GroupDetail>(`/api/groups/${groupId}`, { auth: true }),
    remove: (groupId: string | number) =>
      apiFetch<{ ok: true }>(`/api/groups/${groupId}`, { method: "DELETE", auth: true }),
    players: (groupId: string | number) =>
      apiFetch<PlayerRow[]>(`/api/groups/${groupId}/players`, { auth: true }),
    addPlayer: (groupId: string | number, body: { firstName: string; lastName: string }) =>
      apiFetch<PlayerRow>(`/api/groups/${groupId}/players`, { method: "POST", body, auth: true }),
  },
  players: {
    list: () => apiFetch<ExistingPlayerRow[]>('/api/players', { auth: true }),
    addToGroup: (playerId: number, body: { groupId: number }) =>
      apiFetch<{ ok: true }>(`/api/players/${playerId}`, { method: "POST", body, auth: true }),
    removeFromGroup: (playerId: number, groupId: number) =>
      apiFetch<{ ok: true }>(`/api/players/${playerId}/groups/${groupId}`, { method: "DELETE", auth: true }),
    remove: (playerId: number) =>
      apiFetch<{ ok: true }>(`/api/players/${playerId}`, { method: "DELETE", auth: true }),
  },
  events: {
    list: () => apiFetch<EventListItem[]>("/api/events", { auth: true }),
    create: (rows: NewEvent[]) =>
      apiFetch<{ count: number }>("/api/events", { method: "POST", body: rows, auth: true }),
    get: (eventId: string | number) =>
      apiFetch<EventDetail>(`/api/events/${eventId}`, { auth: true }),
    remove: (eventId: string | number) =>
      apiFetch<{ ok: true }>(`/api/events/${eventId}`, { method: "DELETE", auth: true }),
    attendances: (eventId: string | number) =>
      apiFetch<EventAttendanceRow[]>(`/api/events/${eventId}/attendances`, { auth: true }),
  },
  attendances: {
    setStatus: (attendanceId: number, status: AttendanceStatus) =>
      apiFetch<{ ok: true }>(`/api/attendances/${attendanceId}`, {
        method: "PATCH",
        body: { status },
        auth: true,
      }),
  },
  stats: {
    dashboard: () => apiFetch<DashboardStats>("/api/stats/dashboard", { auth: true }),
    attendance: () => apiFetch<StatsAttendanceRow[]>("/api/stats/attendance", { auth: true }),
  },
};
