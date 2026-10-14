import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type EventGuest, type Meal, type PlayerUpcomingEvent } from "@/lib/api-client";
import { getPlayerCode, clearPlayerCode } from "@/lib/player-session";
import { formatPenaltyBalance } from "@/lib/penalty-format";
import { eventTypeLabel } from "@/lib/event-type";
import { MEAL_META } from "@/lib/meal";
import { EventTypeIcon } from "@/components/event-type-icon";
import { ParticipationSheet } from "@/components/participation-sheet";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trophy, Activity, MapPin, Clock, Check, X, LogOut, Calendar, Wallet, Users, Pencil, Utensils, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/player/")({
  head: () => ({ meta: [{ title: "Meine Übersicht – Spieler" }] }),
  component: PlayerHome,
});

function PlayerHome() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  // Event, für das gerade das Zusage-Sheet offen ist. "n" erzwingt bei jedem Öffnen frische
  // Vorbelegung; das Sheet bleibt beim Schließen kurz gemountet, damit es animiert zugeht.
  const [sheet, setSheet] = useState<{ event: PlayerUpcomingEvent; open: boolean; n: number } | null>(null);
  const openSheet = (event: PlayerUpcomingEvent) => setSheet((s) => ({ event, open: true, n: (s?.n ?? 0) + 1 }));
  const closeSheet = () => setSheet((s) => s && { ...s, open: false });

  useEffect(() => {
    const c = getPlayerCode();
    if (!c) nav({ to: "/auth" });
    else setCode(c);
  }, [nav]);

  const q = useQuery({
    queryKey: ["player-overview", code],
    queryFn: () => api.player.overview({ code: code! }),
    enabled: !!code,
  });

  const m = useMutation({
    mutationFn: (vars: { eventId: number; status: "accepted" | "declined"; meal?: Meal | null; guests?: EventGuest[] }) =>
      api.player.setAttendance({ code: code!, eventId: vars.eventId, status: vars.status, meal: vars.meal, guests: vars.guests }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["player-overview"] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : (e as Error).message),
  });

  function signOut() {
    clearPlayerCode();
    nav({ to: "/auth" });
  }

  if (!code || q.isLoading) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center p-4">
        <div className="card-elevated p-6 text-center max-w-sm">
          <p className="text-sm text-muted-foreground">{(q.error as Error).message}</p>
          <Button onClick={signOut} className="mt-4">Erneut anmelden</Button>
        </div>
      </div>
    );
  }

  const { player, upcoming, history } = q.data!;
  const { moneyText, crateText, hasDebt } = formatPenaltyBalance(player.player_penalty, player.beer_crates);
  // Events (Vereinsfeiern) zählen nicht zur Anwesenheitsquote.
  const all = [...upcoming, ...history].filter((e) => e.event_type !== "event");
  const accepted = all.filter((e) => e.attendances?.[0]?.status === "accepted").length;
  const decided = all.filter((e) => {
    const s = e.attendances?.[0]?.status;
    return s === "accepted" || s === "declined";
  }).length;
  const rate = decided ? Math.round((accepted / decided) * 100) : 0;
  const nextTraining = upcoming.find((e) => e.event_type === "training");
  const nextGame = upcoming.find((e) => e.event_type === "game");

  return (
    <div className="min-h-screen bg-pitch">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-4 h-16">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground leading-none">Angemeldet als</div>
              <div className="font-bold text-sm">{player.first_name} {player.last_name}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {player.penalty_manager && (
              <Button variant="outline" size="sm" onClick={() => nav({ to: "/player/strafen-manager" })}>
                <Wallet className="h-4 w-4 mr-1" /> Strafenmanager
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className={`h-4 w-4 ${player.penalty_manager ? "sm:mr-1" : "mr-1"}`} />
              <span className={player.penalty_manager ? "hidden sm:inline" : ""}>Abmelden</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Hallo {player.first_name} 👋</h1>
            <Button variant="outline" size="sm" onClick={() => nav({ to: "/player/mannschaft" })}>
              <Users className="h-4 w-4 mr-1" /> Mannschaft
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {player.groups?.length ? player.groups.map((g: { name: string }) => g.name).join(" · ") : "Keine Mannschaften"}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Nächstes Training" value={nextTraining ? format(new Date(nextTraining.event_at), "d. MMM", { locale: de }) : "–"} icon={Activity} />
          <MiniStat label="Nächstes Spiel" value={nextGame ? format(new Date(nextGame.event_at), "d. MMM", { locale: de }) : "–"} icon={Trophy} />
          <MiniStat
            label="Schulden"
            value={
              <span className="inline-flex items-baseline gap-1.5">
                <span>{moneyText}</span>
                <span className="text-muted-foreground/40 font-normal">|</span>
                <span>{crateText}</span>
              </span>
            }
            icon={hasDebt ? Wallet : Check}
            danger={hasDebt}
          />
          <MiniStat label="Quote" value={`${rate}%`} icon={Calendar} />
        </div>

        <section>
          <h2 className="font-bold text-lg mb-3">Kommende Ereignisse</h2>
          {upcoming.length === 0 ? (
            <div className="card-elevated p-8 text-center text-muted-foreground text-sm">
              Aktuell keine Ereignisse geplant.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((e, i) => {
                const att = e.attendances[0];
                const status = att?.status ?? "pending";
                const accepted = status === "accepted";
                const guests = accepted ? att?.guests ?? [] : [];
                const meal = accepted && e.with_food ? att?.meal ?? null : null;
                const isEvent = e.event_type === "event";
                // Bei Events mit Essen oder Gästen öffnet die Zusage erst das Sheet – auch wenn der
                // Trainer das Limit inzwischen auf 0 gesenkt hat, damit sich alte Gäste entfernen lassen.
                const usesSheet = isEvent && (e.with_food || e.max_guests > 0 || guests.length > 0);
                // "Mit Essen" kann nachträglich eingeschaltet werden – dann fehlt die Wahl noch.
                const needsMeal = e.with_food && accepted && !meal;
                const deadline = new Date(e.event_at);
                deadline.setHours(13, 0, 0, 0);
                const isDeadlinePassed = e.event_type === "training" && Date.now() >= deadline.getTime();
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`card-elevated p-5 ${isEvent ? "border-yellow-400/60" : ""}`}
                  >
                    <div className="flex items-start gap-4">
                      <EventTypeIcon type={e.event_type} className="h-12 w-12 rounded-xl" iconClassName="h-5 w-5" />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs uppercase tracking-wider font-medium ${isEvent ? "text-yellow-400" : "text-muted-foreground"}`}>
                          {eventTypeLabel(e)}
                        </div>
                        <div className="font-bold text-lg mt-0.5">{e.title}{e.opponent ? `` : ""}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {format(new Date(e.event_at), "EEE d. MMM · HH:mm", { locale: de })}</span>
                          {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
                          {e.with_food && <span className="inline-flex items-center gap-1"><Utensils className="h-3.5 w-3.5" /> Mit Essen</span>}
                        </div>
                        {e.description && <p className="text-sm mt-2 text-muted-foreground">{e.description}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <Button
                        onClick={() => usesSheet ? openSheet(e) : m.mutate({ eventId: e.id, status: "accepted" })}
                        disabled={m.isPending || isDeadlinePassed}
                        className={status === "accepted" ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-foreground hover:bg-primary/20"}
                          title={isDeadlinePassed ? "Antwortfrist (Deadline) überschritten" : undefined}
                      >
                        <Check className="h-4 w-4 mr-1" /> Ich nehme teil
                      </Button>
                      <Button
                        onClick={() => m.mutate({ eventId: e.id, status: "declined" })}
                        disabled={m.isPending || isDeadlinePassed}
                        variant={status === "declined" ? "destructive" : "outline"}
                          title={isDeadlinePassed ? "Antwortfrist (Deadline) überschritten" : undefined}
                      >
                        <X className="h-4 w-4 mr-1" /> Absagen
                      </Button>
                    </div>
                    {usesSheet && accepted && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {meal && <AcceptChip label="Du" meal={meal} />}
                        {guests.map((g, gi) => (
                          <AcceptChip key={gi} label={`${g.name} (Gast)`} meal={e.with_food ? g.meal : null} />
                        ))}
                        {needsMeal ? (
                          <Button size="sm" className="h-7 px-2 text-xs bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25" onClick={() => openSheet(e)}>
                            <Utensils className="h-3.5 w-3.5 mr-1" /> Bitte Essen wählen
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openSheet(e)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Zusage bearbeiten
                          </Button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section>
            <h2 className="font-bold text-lg mb-3">Deine Historie</h2>
            <div className="card-elevated divide-y divide-border">
              {history.slice(0, 20).map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-4">
                  <EventTypeIcon type={h.event_type} className="h-8 w-8 rounded-lg" iconClassName="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{h.title}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(h.event_at), "d. MMM yyyy", { locale: de })}</div>
                  </div>
                  <StatusBadge status={h.attendances[0]?.status} />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {sheet && (
        <ParticipationSheet
          key={sheet.n}
          event={sheet.event}
          open={sheet.open}
          saving={m.isPending}
          onClose={closeSheet}
          onSave={({ meal, guests }) => m.mutate(
            { eventId: sheet.event.id, status: "accepted", meal, guests },
            { onSuccess: closeSheet },
          )}
        />
      )}
    </div>
  );
}

// Grüner Chip für die eigene Zusage bzw. einen Gast, bei Events mit Essen mit Essenswahl.
function AcceptChip({ label, meal }: { label: string; meal: Meal | null }) {
  const Icon = meal ? MEAL_META[meal].icon : null;
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold text-primary bg-primary/15">
      {label}
      {meal && Icon && <><span className="opacity-60">·</span><Icon className="h-3.5 w-3.5" />{MEAL_META[meal].label}</>}
    </span>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <div
      className={`card-elevated p-4 rounded transition-shadow transition-colors ${
        danger ? "border-2 border-red-500" : "border border-transparent"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    accepted: { color: "text-primary bg-primary/15", label: "Zugesagt" },
    declined: { color: "text-destructive bg-destructive/15", label: "Abgesagt" },
    pending: { color: "text-muted-foreground bg-secondary", label: "Offen" },
  }[status as "accepted" | "declined" | "pending"] ?? { color: "text-muted-foreground bg-secondary", label: "–" };
  return <span className={`text-xs px-2 py-1 rounded-full font-semibold ${cfg.color}`}>{cfg.label}</span>;
}
