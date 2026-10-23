import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { MeetingStatus } from "@/lib/api-client";

// Stand eines Einzelgesprächs beim Trainer: grün = Spieler hat einen Termin festgelegt (leuchtet),
// orange = Spieler muss noch wählen, rot = Spieler hat "Keiner passt" gemeldet.
export const MEETING_STATUS_META: Record<MeetingStatus, { label: string; tone: string; text: string }> = {
  confirmed: { label: "Festgelegt", tone: "bg-primary/15 text-primary shadow-glow", text: "text-primary" },
  open: { label: "Offen", tone: "bg-orange-500/15 text-orange-400", text: "text-orange-400" },
  none_fits: { label: "Keiner passt", tone: "bg-destructive/15 text-destructive", text: "text-destructive" },
};

// Wie im Backend: aktuell bis 1 Stunde nach dem gewählten Termin, ohne Festlegung bis
// 1 Stunde nach dem letzten Vorschlag – danach zählt das Gespräch als vergangen.
const GRACE_MS = 60 * 60 * 1000;

export function meetingActiveUntil(m: { event_at: string; proposed_times: string[]; meeting_status: MeetingStatus | null }) {
  const times = m.meeting_status === "confirmed" || m.proposed_times.length === 0
    ? [m.event_at]
    : m.proposed_times;
  return Math.max(...times.map((t) => new Date(t).getTime())) + GRACE_MS;
}

export function isMeetingActive(m: { event_at: string; proposed_times: string[]; meeting_status: MeetingStatus | null }, now = Date.now()) {
  return now < meetingActiveUntil(m);
}

// "Mo 3. Nov · 18:00" – Termine stehen untereinander, daher mit Wochentag und Uhrzeit.
export function formatProposal(iso: string, withYear = false) {
  return format(new Date(iso), withYear ? "EEE d. MMM yyyy · HH:mm" : "EEE d. MMM · HH:mm", { locale: de });
}

// Gewählter Termin = derjenige Vorschlag, auf den das Ereignis nach der Festlegung gesetzt wurde.
export function isChosenProposal(iso: string, m: { event_at: string; meeting_status: MeetingStatus | null }) {
  return m.meeting_status === "confirmed" && new Date(iso).getTime() === new Date(m.event_at).getTime();
}
