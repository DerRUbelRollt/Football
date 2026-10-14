import { Activity, PartyPopper, Trophy, type LucideIcon } from "lucide-react";
import type { EventType } from "@/lib/api-client";

// Bezeichnung, Icon und Farbe je Ereignistyp – überall gleich, damit Events (gelb)
// sofort von Trainings (grün) und Spielen (blau) zu unterscheiden sind.
export const EVENT_TYPE_META: Record<EventType, { label: string; icon: LucideIcon; tone: string }> = {
  training: { label: "Training", icon: Activity, tone: "bg-primary/15 text-primary" },
  game: { label: "Spiel", icon: Trophy, tone: "bg-chart-2/15 text-chart-2" },
  event: { label: "Event", icon: PartyPopper, tone: "bg-yellow-400/15 text-yellow-400" },
};

// Überschrift über dem Titel, bei Spielen mit Heim/Auswärts.
export function eventTypeLabel(e: { event_type: EventType; home_away?: "home" | "away" | null }) {
  if (e.event_type === "game" && e.home_away) return `Spiel · ${e.home_away === "home" ? "Heim" : "Auswärts"}`;
  return EVENT_TYPE_META[e.event_type].label;
}
