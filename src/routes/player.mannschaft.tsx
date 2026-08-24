import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, PlayerTeamPenaltyRow, type PlayerTeamGameRow } from "@/lib/api-client";
import { getPlayerCode } from "@/lib/player-session";
import { formatPenaltyBalance } from "@/lib/penalty-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Users, Goal, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/player/mannschaft")({
  head: () => ({ meta: [{ title: "Mannschaft – Spieler" }] }),
  component: MannschaftView,
});

type ResultKind = "win" | "draw" | "loss" | "none";

function resultKind(g: PlayerTeamGameRow): ResultKind {
  if (g.home_score == null || g.away_score == null || !g.home_away) return "none";
  const own = g.home_away === "away" ? g.away_score : g.home_score;
  const opp = g.home_away === "away" ? g.home_score : g.away_score;
  if (own > opp) return "win";
  if (own < opp) return "loss";
  return "draw";
}

const KIND_BADGE_CLASS: Record<ResultKind, string> = {
  win: "bg-primary/15 text-primary",
  draw: "bg-warning/15 text-warning",
  loss: "bg-destructive/15 text-destructive",
  none: "bg-secondary text-muted-foreground",
};

const KIND_LIGHT_CLASS: Record<ResultKind, string> = {
  win: "bg-primary",
  draw: "bg-warning",
  loss: "bg-destructive",
  none: "bg-secondary",
};

const KIND_LABEL_DE: Record<ResultKind, string> = {
  win: "Sieg",
  draw: "Unentschieden",
  loss: "Niederlage",
  none: "Kein Ergebnis",
};

function MannschaftView() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const c = getPlayerCode();
    if (!c) nav({ to: "/auth" });
    else setCode(c);
  }, [nav]);

  const q = useQuery({
    queryKey: ["player-team", code],
    queryFn: () => api.player.team({ code: code! }),
    enabled: !!code,
  });

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
          <Button onClick={() => nav({ to: "/player" })} className="mt-4">Zurück</Button>
        </div>
      </div>
    );
  }

  const { attendanceTable, currentGame, pastGames, penalties } = q.data!;
  const formGuide = [...pastGames].reverse();

  return (
    <div className="min-h-screen bg-pitch">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-4 h-16">
          <Link to="/player" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="font-bold text-sm">Mannschaft</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-20 sm:pb-10 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Deine Mannschaft</h1>
          <p className="text-muted-foreground text-sm mt-1">Spielergebnisse, Anwesenheit und Bierkasten-Stand im Überblick.</p>
        </div>

        {currentGame && (
          <section>
            <h2 className="font-bold text-lg mb-3">Aktuelles Spiel</h2>
            <div className="card-elevated p-5 sm:p-6 border-2 border-primary/40 shadow-glow space-y-3">
              <LiveBadge eventAt={currentGame.event_at} />
              <div>
                <div className="font-bold text-lg leading-snug">
                  {currentGame.opponent ?? currentGame.title}
                  {currentGame.home_away && <span className="text-muted-foreground font-normal text-sm"> · {currentGame.home_away === "home" ? "Heim" : "Auswärts"}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(currentGame.event_at), "d. MMM yyyy · HH:mm", { locale: de })} Uhr
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                {currentGame.home_score != null && currentGame.away_score != null ? (
                  <span className="text-sm px-2.5 py-1 rounded-full font-bold bg-secondary">
                    {currentGame.home_score}:{currentGame.away_score}
                  </span>
                ) : <span />}
                <GameResultDialog game={currentGame} code={code!} onSaved={() => qc.invalidateQueries({ queryKey: ["player-team", code] })} />
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="font-bold text-lg mb-3">Vergangene Spiele</h2>

          {formGuide.length > 0 && (
            <div className="flex items-center justify-center gap-2.5 mb-3">
              {formGuide.map((g) => {
                const kind = resultKind(g);
                return (
                  <span
                    key={g.id}
                    title={`${g.opponent ?? g.title}: ${g.home_score != null && g.away_score != null ? `${g.home_score}:${g.away_score}` : "kein Ergebnis"} (${KIND_LABEL_DE[kind]})`}
                    className={`h-4 w-4 rounded-full shrink-0 ${KIND_LIGHT_CLASS[kind]}`}
                  />
                );
              })}
            </div>
          )}

          {pastGames.length === 0 ? (
            <div className="card-elevated p-8 text-center text-muted-foreground text-sm">
              Noch keine vergangenen Spiele.
            </div>
          ) : (
            <div className="card-elevated divide-y divide-border">
              {pastGames.map((g) => {
                const kind = resultKind(g);
                return (
                  <div key={g.id} className="p-4 space-y-2">
                    <div>
                      <div className="font-medium leading-snug">
                        {g.opponent ?? g.title}
                        {g.home_away && <span className="text-muted-foreground font-normal"> · {g.home_away === "home" ? "Heim" : "Auswärts"}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(g.event_at), "d. MMM yyyy", { locale: de })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      {kind !== "none" ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${KIND_BADGE_CLASS[kind]}`}>
                          {formatScore(g.home_score, g.away_score)}
                        </span>
                      ) : <span />}
                      <GameResultDialog game={g} code={code!} onSaved={() => qc.invalidateQueries({ queryKey: ["player-team", code] })} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3">Anwesenheit</h2>
          {attendanceTable.length === 0 ? (
            <div className="card-elevated p-8 text-center text-muted-foreground text-sm">
              Noch keine vergangenen Ereignisse.
            </div>
          ) : (
            <div className="card-elevated p-5 sm:p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Spieler</th>
                    <th className="py-2 px-3">Trainings/Spiele</th>
                    <th className="py-2 px-3">Teilgenommen</th>
                    <th className="py-2 px-3">Abgesagt</th>
                    <th className="py-2 px-3">Offen</th>
                    <th className="py-2 px-3">Quote</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceTable.map((p) => (
                    <tr key={p.player_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3 font-medium">{p.first_name} {p.last_name}</td>
                      <td className="py-2 px-3 font-bold">{p.quote}%</td>
                      <td className="py-2 px-3">{p.total}</td>
                      <td className="py-2 px-3 text-primary">{p.accepted}</td>
                      <td className="py-2 px-3 text-destructive">{p.declined}</td>
                      <td className="py-2 px-3 text-muted-foreground">{p.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3">Bierkasten-Rangliste</h2>
          <div className="card-elevated divide-y divide-border">
            {formatFilterBeerCrates(penalties).map((p, i) => {
              const { moneyText, crateText, hasDebt } = formatPenaltyBalance(0, p.beer_crates);
              return (
                <div key={p.id} className="flex items-center gap-3 p-4">
                  <div className="w-5 text-center text-xs text-muted-foreground font-semibold shrink-0">{i + 1}</div>
                  <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center text-xs font-bold shrink-0">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="min-w-0 flex-1 font-medium truncate">{p.first_name} {p.last_name}</div>
                  <div className={`text-xs font-mono shrink-0 ${hasDebt ? "text-destructive" : "text-muted-foreground"}`}>
                     {crateText}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function formatScore(home: number | null, away: number | null): string {
  if (home == null || away == null) return "-";
  return `${home}:${away}`;
}

function formatFilterBeerCrates(penalties: PlayerTeamPenaltyRow[]): PlayerTeamPenaltyRow[] {
  const penaltyFilteredByBeerCrates = [...penalties];
  penaltyFilteredByBeerCrates.sort((a, b) => b.beer_crates - a.beer_crates);
  return penaltyFilteredByBeerCrates;
}

function LiveBadge({ eventAt }: { eventAt: string }) {
  const live = new Date(eventAt).getTime() <= Date.now();
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full shrink-0 bg-destructive/15 text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> Live
      </span>
    );
  }
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full shrink-0 bg-primary/15 text-primary">
      <Clock className="h-3 w-3" /> Bald
    </span>
  );
}

function GameResultDialog({ game, code, onSaved }: { game: PlayerTeamGameRow; code: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const isAway = game.home_away === "away";
  const [ownGoals, setOwnGoals] = useState(String((isAway ? game.away_score : game.home_score) ?? ""));
  const [oppGoals, setOppGoals] = useState(String((isAway ? game.home_score : game.away_score) ?? ""));

  const m = useMutation({
    mutationFn: () => {
      const own = ownGoals.trim() === "" ? null : Number(ownGoals);
      const opp = oppGoals.trim() === "" ? null : Number(oppGoals);
      return api.player.setEventResult({
        code,
        eventId: game.id,
        homeScore: isAway ? opp : own,
        awayScore: isAway ? own : opp,
      });
    },
    onSuccess: () => { toast.success("Ergebnis gespeichert"); setOpen(false); onSaved(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : (e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Goal className="h-3.5 w-3.5 mr-1" /> {game.home_score != null ? "Bearbeiten" : "Ergebnis eintragen"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{game.opponent ?? game.title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center gap-3">
          <div className="space-y-1 text-center">
            <div className="text-xs text-muted-foreground">Unsere Tore</div>
            <Input type="number" min="0" step="1" value={ownGoals} onChange={(e) => setOwnGoals(e.target.value)} className="w-16 text-center" />
          </div>
          <span className="text-muted-foreground mt-4">:</span>
          <div className="space-y-1 text-center">
            <div className="text-xs text-muted-foreground">Tore Gegner</div>
            <Input type="number" min="0" step="1" value={oppGoals} onChange={(e) => setOppGoals(e.target.value)} className="w-16 text-center" />
          </div>
        </div>
        <Button className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>Speichern</Button>
      </DialogContent>
    </Dialog>
  );
}
