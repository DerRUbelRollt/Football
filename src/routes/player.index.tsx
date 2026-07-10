import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { getPlayerCode, clearPlayerCode } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trophy, Activity, MapPin, Clock, Check, X, LogOut, Calendar } from "lucide-react";
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
    mutationFn: (vars: { eventId: number; status: "accepted" | "declined" }) =>
      api.player.setAttendance({ code: code!, eventId: vars.eventId, status: vars.status }),
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
  const all = [...upcoming, ...history];
  const accepted = all.filter((e: any) => e.attendances?.[0]?.status === "accepted").length;
  const decided = all.filter((e: any) => {
    const s = e.attendances?.[0]?.status;
    return s === "accepted" || s === "declined";
  }).length;
  const rate = decided ? Math.round((accepted / decided) * 100) : 0;
  const nextTraining = upcoming.find((e: any) => e.event_type === "training");
  const nextGame = upcoming.find((e: any) => e.event_type === "game");

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
          <Button variant="ghost" size="sm" onClick={signOut} className="ml-auto">
            <LogOut className="h-4 w-4 mr-1" /> Abmelden
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Hallo {player.first_name} 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">{(player.groups as any)?.name}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Nächstes Training" value={nextTraining ? format(new Date(nextTraining.event_at), "d. MMM", { locale: de }) : "–"} icon={Activity} />
          <MiniStat label="Nächstes Spiel" value={nextGame ? format(new Date(nextGame.event_at), "d. MMM", { locale: de }) : "–"} icon={Trophy} />
          <MiniStat label="Zusagen" value={accepted} icon={Check} />
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
              {upcoming.map((e: any, i: number) => {
                const status = e.attendances[0]?.status ?? "pending";
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="card-elevated p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 ${e.event_type === "training" ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2"}`}>
                        {e.event_type === "training" ? <Activity className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                          {e.event_type === "training" ? "Training" : `Spiel${e.home_away ? ` · ${e.home_away === "home" ? "Heim" : "Auswärts"}` : ""}`}
                        </div>
                        <div className="font-bold text-lg mt-0.5">{e.title}{e.opponent ? ` vs ${e.opponent}` : ""}</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {format(new Date(e.event_at), "EEE d. MMM · HH:mm", { locale: de })}</span>
                          {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
                        </div>
                        {e.description && <p className="text-sm mt-2 text-muted-foreground">{e.description}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <Button
                        onClick={() => m.mutate({ eventId: e.id, status: "accepted" })}
                        disabled={m.isPending}
                        className={status === "accepted" ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-foreground hover:bg-primary/20"}
                      >
                        <Check className="h-4 w-4 mr-1" /> Ich nehme teil
                      </Button>
                      <Button
                        onClick={() => m.mutate({ eventId: e.id, status: "declined" })}
                        disabled={m.isPending}
                        variant={status === "declined" ? "destructive" : "outline"}
                      >
                        <X className="h-4 w-4 mr-1" /> Absagen
                      </Button>
                    </div>
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
              {history.slice(0, 20).map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 p-4">
                  <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${h.event_type === "training" ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2"}`}>
                    {h.event_type === "training" ? <Activity className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                  </div>
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
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
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
