import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { PaceGroup, PreparationHistoryStatus, PreparationStatus } from "@/lib/api-client";

// Gemeinsame Bausteine für Fitness-Vorbereitungen (Laufpläne): Wochen, Pace, Gruppen, Farben.

export const PACE_GROUPS: PaceGroup[] = ["A", "B", "C"];
export const DEFAULT_PACE_GROUP: PaceGroup = "B";
export const MAX_WEEKS = 12;
export const MAX_RUNS_PER_WEEK = 4;
export const MAX_RULES = 10;

export const PACE_GROUP_META: Record<PaceGroup, { name: string; label: string }> = {
  A: { name: "Laufstark", label: "A – Laufstark" },
  B: { name: "Durchschnitt", label: "B – Durchschnitt" },
  C: { name: "Wiedereinstieg", label: "C – Wiedereinstieg" },
};

// Vorbelegung im Dialog (wie im Beispielplan): 5 km pro Lauf, Pace wird jede Woche 10 s schneller.
export const DEFAULT_DISTANCE_KM = 5;
export const DEFAULT_PACE_SEC: Record<PaceGroup, number> = { A: 345, B: 390, C: 435 };
export const PACE_STEP_PER_WEEK = 10;
export const DEFAULT_RULES = [
  "Mindestens 48 Stunden Pause zwischen zwei Läufen einhalten.",
  "Vor dem Lauf 5 Minuten locker aufwärmen und mobilisieren; danach ruhig auslaufen.",
  "Kein Wettkampf und keine maximale Belastung: saubere, gleichmäßige Dauerläufe.",
  "Wer 5 km noch nicht locker schafft, verkürzt die Strecke oder legt Gehpausen ein.",
  "Bei Schmerzen oder Krankheit pausieren; ausgefallene Läufe nicht nachholen.",
  "Nach jedem Lauf optional Distanz, Durchschnittspace und Belastung (1–10) an das Trainerteam melden.",
];

// Pinke Akzentfarbe aller Vorbereitungs-Elemente (passend zum Hantel-Icon).
export const PREP_TONE = {
  text: "text-pink-400",
  icon: "bg-pink-500/15 text-pink-400",
  iconRing: "bg-pink-500/15 ring-1 ring-pink-500/30",
  border: "border-pink-500/60",
  box: "border border-pink-500/30 bg-pink-500/5",
};

export interface PlanWeek {
  number: number;
  start: Date;
  end: Date;
}

// Kalenderwochen (Mo–So) zwischen Start- und Enddatum in Ortszeit: Woche 1 beginnt am Startdatum
// um 0:00, jede Woche endet Sonntag 23:59:59, die letzte am Enddatum 23:59:59.
// Liefert bei zu langem Zeitraum MAX_WEEKS + 1 Wochen, damit der Aufrufer das melden kann.
export function computeWeeks(startDate: string, endDate: string): PlanWeek[] {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(last.getTime()) || last < start) return [];
  const weeks: PlanWeek[] = [];
  let cursor = start;
  while (cursor <= last && weeks.length <= MAX_WEEKS) {
    const sunday = endOfWeek(cursor, { weekStartsOn: 1 });
    weeks.push({ number: weeks.length + 1, start: cursor, end: sunday < last ? sunday : last });
    cursor = startOfWeek(addDays(sunday, 1), { weekStartsOn: 1 });
  }
  return weeks;
}

// 345 → "5:45"
export function formatPace(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// "5:45", "5.45", "5,45" oder "6" → Sekunden pro km; null bei ungültiger Eingabe.
export function parsePace(input: string): number | null {
  const m = input.trim().match(/^(\d{1,2})(?:[:.,](\d{1,2}))?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = m[2] === undefined ? 0 : Number(m[2].length === 1 ? `${m[2]}0` : m[2]);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

export const isValidPace = (sec: number | null): sec is number => sec !== null && sec >= 180 && sec <= 720;

// "5,5" oder "5.5" → 5.5; null bei ungültiger Eingabe.
export function parseKm(input: string): number | null {
  const n = Number(input.trim().replace(",", "."));
  return input.trim() === "" || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

export const isValidKm = (km: number | null): km is number => km !== null && km >= 0.5 && km <= 50;

// 5.5 → "5,5"
export function formatKm(km: number): string {
  return km.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export function unitLabel(week: number, run: number): string {
  return `Woche ${week} · Training ${run}`;
}

// "Mi 07.01. – So 11.01., 23:59"
export function formatWindow(startsAt: string | Date, endsAt: string | Date): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  return `${format(s, "EEEEEE dd.MM.", { locale: de })} – ${format(e, "EEEEEE dd.MM., HH:mm", { locale: de })}`;
}

// "07.01. – 11.01." (kompakt, z. B. im Dialog)
export function formatShortRange(start: Date, end: Date): string {
  return `${format(start, "dd.MM.")}–${format(end, "dd.MM.")}`;
}

// Zeitraum einer Vorbereitung aus den Datumsfeldern ("2027-01-06").
export function formatDateRange(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  return `${format(s, "dd.MM.")} – ${format(e, "dd.MM.yyyy")}`;
}

export function initials(first: string, last: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

// Stand eines Spielers bei einem Vorbereitungs-Ereignis (Trainer-Liste, Spieler-Karte).
export const PREP_STATUS_META: Record<PreparationStatus, { label: string; tone: string }> = {
  pending: { label: "Offen", tone: "text-warning bg-warning/15" },
  done: { label: "Erledigt", tone: "text-primary bg-primary/15" },
  declined: { label: "Abgesagt", tone: "text-destructive bg-destructive/15" },
  missed: { label: "Verpasst", tone: "text-destructive bg-destructive/15" },
};

// Stand eines abgelaufenen Vorbereitungs-Ereignisses in der Spieler-Historie.
export const PREP_HISTORY_META: Record<PreparationHistoryStatus, { label: string; tone: string }> = {
  confirmed: { label: "Bestätigt", tone: "text-primary bg-primary/15" },
  done: { label: "Erledigt", tone: "text-primary bg-primary/15" },
  declined: { label: "Abgesagt", tone: "text-destructive bg-destructive/15" },
  missed: { label: "Verpasst", tone: "text-muted-foreground bg-secondary" },
  rejected: { label: "Nicht bestätigt", tone: "text-orange-400 bg-orange-500/15" },
};
