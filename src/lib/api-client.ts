export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface ApiFetchOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, query } = opts;

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

  // Die Trainer-Session läuft über ein HttpOnly-Cookie (tc_session),
  // das der Browser bei Same-Origin-Requests automatisch mitschickt.
  const res = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
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
    const err = (
      parsed && typeof parsed === "object" && "error" in parsed
        ? (parsed as { error: string }).error
        : `Request failed (${res.status})`
    ) as string;
    throw new ApiError(err, res.status, parsed);
  }

  return parsed as T;
}

// ---------- Typed wrappers ----------

export interface AuthUser {
  id: number;
  name: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface PlayerSummary {
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
  group_id: number;
  player_penalty: number;
  beer_crates: number;
  penalty_manager: boolean;
  groups: { name: string }[];
}

export interface PlayerPenaltyRow {
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
  player_penalty: number;
  beer_crates: number;
}

export type AttendanceStatus = "accepted" | "declined" | "pending";

// "preparation" kommt nur in der Spieler-Historie vor (abgelaufene Vorbereitungs-Ereignisse) –
// Vorbereitungen sind keine normalen Ereignisse und lassen sich dort nicht anlegen.
export type EventType = "training" | "game" | "event" | "meeting" | "preparation";

// Stand eines Einzelgesprächs: Spieler muss noch wählen, hat einen Termin festgelegt
// oder hat "Keiner passt" gemeldet.
export type MeetingStatus = "open" | "confirmed" | "none_fits";

export interface PersonName {
  first_name: string;
  last_name: string;
}

export type Meal = "vegan" | "vegetarian" | "meat";

export interface EventGuest {
  name: string;
  meal: Meal | null;
}

export interface PlayerEventAttendance {
  id?: number;
  status: AttendanceStatus;
  player_id: number;
  meal?: Meal | null;
  guests?: EventGuest[];
}

export interface PlayerHistoryEvent {
  id: number;
  event_type: EventType;
  title: string;
  event_at: string;
  attendances: PlayerEventAttendance[];
  // Nur bei event_type "preparation".
  preparation_status?: PreparationHistoryStatus | null;
}

export interface PlayerUpcomingEvent extends PlayerHistoryEvent {
  opponent: string | null;
  home_away: "home" | "away" | null;
  location: string | null;
  meeting_point: string | null;
  description: string | null;
  max_guests: number;
  with_food: boolean;
  deadline_at: string | null;
}

export interface PlayerMeeting {
  id: number;
  event_type: "meeting";
  title: string;
  location: string | null;
  description: string | null;
  event_at: string;
  proposed_times: string[];
  meeting_status: MeetingStatus;
}

export interface PlayerOverview {
  player: PlayerSummary;
  upcoming: PlayerUpcomingEvent[];
  meetings: PlayerMeeting[];
  preparations?: PlayerPreparation[];
  history: PlayerHistoryEvent[];
}

// ---------- Vorbereitung (Laufplan) ----------

export type PaceGroup = "A" | "B" | "C";

// Stand eines Spielers bei einem Vorbereitungs-Ereignis. "missed" = Woche vorbei, nichts gemeldet.
export type PreparationStatus = "pending" | "done" | "declined" | "missed";

// Stand in der Spieler-Historie; "rejected" = vom Trainer nicht bestätigt und nicht neu eingereicht.
export type PreparationHistoryStatus = "confirmed" | "done" | "declined" | "missed" | "rejected";

export interface PlayerPreparationUnit {
  id: number;
  week_number: number;
  run_number: number;
  starts_at: string;
  ends_at: string;
  distance_km: number;
  pace_sec: number;
  status: PreparationStatus;
  confirmed: boolean;
  trainer_comment: string | null;
  decline_reason: string | null;
  has_image: boolean;
}

export interface PlayerPreparation {
  id: number;
  title: string;
  rules: string[];
  pace_group: PaceGroup;
  units: PlayerPreparationUnit[];
}

export interface PreparationListItem {
  id: number;
  title: string;
  group: { id: number; name: string };
  start_date: string;
  end_date: string;
  runs_per_week: number;
  weeks_count: number;
  units_count: number;
  player_count: number;
  to_review: number;
  ended: boolean;
}

export interface PreparationWeekDetail {
  number: number;
  starts_at: string;
  ends_at: string;
  pace: Record<PaceGroup, number>;
  units: { id: number; run_number: number; distance_km: number }[];
}

export interface PreparationDetail extends PreparationListItem {
  rules: string[];
  weeks: PreparationWeekDetail[];
  pace_groups: Record<PaceGroup, { players: number; to_review: number }>;
}

export interface NewPreparationWeek {
  startsAt: string;
  endsAt: string;
  distancesKm: number[];
  paceASec: number;
  paceBSec: number;
  paceCSec: number;
}

export interface NewPreparation {
  title: string;
  groupId: number;
  startDate: string;
  endDate: string;
  runsPerWeek: number;
  rules: string[];
  weeks: NewPreparationWeek[];
}

export interface PreparationUpdate {
  title: string;
  rules: string[];
  weeks: Omit<NewPreparationWeek, "startsAt" | "endsAt">[];
}

export interface PreparationPlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
  pace_group: PaceGroup;
}

export interface PreparationGroupUnit {
  id: number;
  week_number: number;
  run_number: number;
  starts_at: string;
  ends_at: string;
  distance_km: number;
  pace_sec: number;
  total: number;
  done: number;
  not_done: number;
  open: number;
  to_review: number;
}

export interface PreparationRef {
  id: number;
  title: string;
  group: { id: number; name: string };
}

export interface PreparationGroupData {
  preparation: PreparationRef;
  pace_group: PaceGroup;
  players: number;
  units: PreparationGroupUnit[];
}

export interface PreparationUnitRow {
  player: { id: number; first_name: string; last_name: string; player_code: string };
  status: PreparationStatus;
  confirmed: boolean;
  has_image: boolean;
  rejected: boolean;
}

export interface PreparationUnitDetail {
  id: number;
  week_number: number;
  run_number: number;
  starts_at: string;
  ends_at: string;
  distance_km: number;
  pace_sec: number;
  pace_group: PaceGroup;
  preparation: PreparationRef;
  rows: PreparationUnitRow[];
}

export interface PreparationEntryDetail {
  player: PersonName & { id: number };
  pace_group: PaceGroup;
  status: PreparationStatus;
  confirmed: boolean;
  description: string | null;
  decline_reason: string | null;
  trainer_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  image: string | null;
  image_removed: boolean;
  week_ended: boolean;
}

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

export interface DuplicatePlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  player_code: string;
}

export interface EventListItem {
  id: number;
  event_type: EventType;
  title: string;
  opponent: string | null;
  home_away: "home" | "away" | null;
  location: string | null;
  event_at: string;
  groups: { name: string } | null;
  // Nur bei Einzelgesprächen befüllt.
  player: PersonName | null;
  proposed_times: string[];
  meeting_status: MeetingStatus | null;
}

export interface EventDetail extends EventListItem {
  meeting_point: string | null;
  description: string | null;
  group_id: number | null;
  player_id: number | null;
  home_score: number | null;
  away_score: number | null;
  max_guests: number;
  with_food: boolean;
  deadline_at: string | null;
}

export interface NewEvent {
  eventType: EventType;
  title: string;
  opponent: string | null;
  homeAway: "home" | "away" | null;
  location: string | null;
  meetingPoint: string | null;
  eventAt: string;
  description: string | null;
  groupId: number | null;
  maxGuests: number | null;
  withFood: boolean | null;
  deadlineAt: string | null;
  // Nur bei Einzelgesprächen; beim Bearbeiten null = unverändert lassen.
  playerId: number | null;
  proposedTimes: string[] | null;
}

export type EventUpdate = Omit<NewEvent, "eventType">;

export interface EventAttendanceRow {
  id: number;
  status: AttendanceStatus;
  meal: Meal | null;
  guests: EventGuest[];
  players: {
    id: number;
    first_name: string;
    last_name: string;
    player_code: string;
  } | null;
}

export interface DashboardMeeting {
  id: number;
  title: string;
  location: string | null;
  event_at: string;
  proposed_times: string[];
  meeting_status: MeetingStatus;
  player: PersonName | null;
}

export interface DashboardStats {
  groups: number;
  players: number;
  upcoming: EventListItem[];
  rate: number;
  meetings: DashboardMeeting[];
}

export interface StatsAttendanceRow {
  status: AttendanceStatus;
  players: { id: number; first_name: string; last_name: string } | null;
  events: { event_at: string } | null;
}

export interface PlayerTeamAttendanceRow {
  player_id: number;
  first_name: string;
  last_name: string;
  total: number;
  accepted: number;
  declined: number;
  pending: number;
  quote: number;
}

export interface PlayerTeamGameRow {
  id: number;
  title: string;
  opponent: string | null;
  home_away: "home" | "away" | null;
  event_at: string;
  home_score: number | null;
  away_score: number | null;
}

export interface PlayerTeamPenaltyRow {
  id: number;
  first_name: string;
  last_name: string;
  player_penalty: number;
  beer_crates: number;
}

export interface PlayerTeamData {
  attendanceTable: PlayerTeamAttendanceRow[];
  currentGame: PlayerTeamGameRow | null;
  pastGames: PlayerTeamGameRow[];
  penalties: PlayerTeamPenaltyRow[];
}

export const api = {
  auth: {
    login: (body: { name: string; password: string }) =>
      apiFetch<AuthResponse>("/api/auth/login", { method: "POST", body }),
    verify: () =>
      apiFetch<{ userId: number; name: string }>("/api/auth/verify", { method: "POST" }),
    logout: () => apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    updateProfile: (body: { currentPassword: string; newName?: string; newPassword?: string }) =>
      apiFetch<{ id: number; name: string }>("/api/auth/me", { method: "PATCH", body }),
    createTrainer: (body: { name: string; password: string; currentPassword: string }) =>
      apiFetch<{ id: number; name: string }>("/api/auth/trainers", { method: "POST", body }),
  },
  player: {
    login: (body: { code: string }) =>
      apiFetch<{ player: PlayerSummary }>("/api/player/login", { method: "POST", body }),
    overview: (body: { code: string }) =>
      apiFetch<PlayerOverview>("/api/player/overview", { method: "POST", body }),
    setAttendance: (body: { code: string; eventId: number; status: AttendanceStatus; meal?: Meal | null; guests?: EventGuest[] }) =>
      apiFetch<{ ok: true }>("/api/player/attendance", { method: "POST", body }),
    answerMeeting: (body: { code: string; eventId: number; chosenAt?: string; noneFits?: boolean }) =>
      apiFetch<{ ok: true }>("/api/player/meeting", { method: "POST", body }),
    penalty: (body: { managerCode: string; code: string; amount: number; crateAmount?: number }) =>
      apiFetch<{ ok: true; player_id: number; player_penalty: number; beer_crates: number }>("/api/player/penalty", { method: "PATCH", body }),
    allPenalties: (body: { managerCode: string }) =>
      apiFetch<PlayerPenaltyRow[]>("/api/player/penalties", { method: "POST", body }),
    team: (body: { code: string }) =>
      apiFetch<PlayerTeamData>("/api/player/team", { method: "POST", body }),
    setEventResult: (body: { code: string; eventId: number; homeScore: number | null; awayScore: number | null }) =>
      apiFetch<{ ok: true; home_score: number | null; away_score: number | null }>("/api/player/event-result", { method: "PATCH", body }),
    preparationDone: (body: { code: string; unitId: number; image: string; description: string | null }) =>
      apiFetch<{ ok: true }>("/api/player/preparation-done", { method: "POST", body }),
    preparationDecline: (body: { code: string; unitId: number; reason: string }) =>
      apiFetch<{ ok: true }>("/api/player/preparation-decline", { method: "POST", body }),
    preparationEntry: (body: { code: string; unitId: number }) =>
      apiFetch<PreparationEntryDetail>("/api/player/preparation-entry", { method: "POST", body }),
  },
  preparations: {
    list: () => apiFetch<PreparationListItem[]>("/api/preparations"),
    create: (body: NewPreparation) =>
      apiFetch<{ id: number; count: number }>("/api/preparations", { method: "POST", body }),
    get: (id: string | number) => apiFetch<PreparationDetail>(`/api/preparations/${id}`),
    update: (id: string | number, body: PreparationUpdate) =>
      apiFetch<{ ok: true }>(`/api/preparations/${id}`, { method: "PATCH", body }),
    remove: (id: string | number) =>
      apiFetch<{ ok: true }>(`/api/preparations/${id}`, { method: "DELETE" }),
    players: (id: string | number) => apiFetch<PreparationPlayerRow[]>(`/api/preparations/${id}/players`),
    setPaceGroup: (id: string | number, playerId: number, group: PaceGroup) =>
      apiFetch<{ ok: true; pace_group: PaceGroup }>(`/api/preparations/${id}/players/${playerId}`, { method: "PUT", body: { group } }),
    group: (id: string | number, group: PaceGroup) =>
      apiFetch<PreparationGroupData>(`/api/preparations/${id}/groups/${group}`),
    unit: (unitId: string | number, group: PaceGroup) =>
      apiFetch<PreparationUnitDetail>(`/api/preparation-units/${unitId}`, { query: { group } }),
    entry: (unitId: string | number, playerId: number) =>
      apiFetch<PreparationEntryDetail>(`/api/preparation-units/${unitId}/players/${playerId}`),
    review: (unitId: string | number, playerId: number, body: { decision: "confirm" | "reject"; comment?: string | null }) =>
      apiFetch<{ ok: true }>(`/api/preparation-units/${unitId}/players/${playerId}/review`, { method: "POST", body }),
  },
  groups: {
    list: () => apiFetch<GroupSummary[]>("/api/groups"),
    create: (body: { name: string; description: string | null }) =>
      apiFetch<GroupDetail>("/api/groups", { method: "POST", body }),
    get: (groupId: string | number) => apiFetch<GroupDetail>(`/api/groups/${groupId}`),
    remove: (groupId: string | number) =>
      apiFetch<{ ok: true }>(`/api/groups/${groupId}`, { method: "DELETE" }),
    players: (groupId: string | number) => apiFetch<PlayerRow[]>(`/api/groups/${groupId}/players`),
    addPlayer: (groupId: string | number, body: { firstName: string; lastName: string; force?: boolean }) =>
      apiFetch<PlayerRow>(`/api/groups/${groupId}/players`, { method: "POST", body }),
  },
  players: {
    list: () => apiFetch<ExistingPlayerRow[]>("/api/players"),
    addToGroup: (playerId: number, body: { groupId: number }) =>
      apiFetch<{ ok: true }>(`/api/players/${playerId}`, { method: "POST", body }),
    removeFromGroup: (playerId: number, groupId: number) =>
      apiFetch<{ ok: true }>(`/api/players/${playerId}/groups/${groupId}`, { method: "DELETE" }),
    remove: (playerId: number) =>
      apiFetch<{ ok: true }>(`/api/players/${playerId}`, { method: "DELETE" }),
  },
  events: {
    list: () => apiFetch<EventListItem[]>("/api/events"),
    create: (rows: NewEvent[]) =>
      apiFetch<{ count: number }>("/api/events", { method: "POST", body: rows }),
    get: (eventId: string | number) => apiFetch<EventDetail>(`/api/events/${eventId}`),
    update: (eventId: string | number, body: EventUpdate) =>
      apiFetch<{ ok: true }>(`/api/events/${eventId}`, { method: "PATCH", body }),
    remove: (eventId: string | number) =>
      apiFetch<{ ok: true }>(`/api/events/${eventId}`, { method: "DELETE" }),
    attendances: (eventId: string | number) =>
      apiFetch<EventAttendanceRow[]>(`/api/events/${eventId}/attendances`),
    setResult: (eventId: string | number, body: { homeScore: number | null; awayScore: number | null }) =>
      apiFetch<{ ok: true; home_score: number | null; away_score: number | null }>(`/api/events/${eventId}/result`, { method: "PATCH", body }),
  },
  attendances: {
    setStatus: (attendanceId: number, status: AttendanceStatus) =>
      apiFetch<{ ok: true }>(`/api/attendances/${attendanceId}`, {
        method: "PATCH",
        body: { status },
      }),
  },
  stats: {
    dashboard: () => apiFetch<DashboardStats>("/api/stats/dashboard"),
    attendance: () => apiFetch<StatsAttendanceRow[]>("/api/stats/attendance"),
  },
};
