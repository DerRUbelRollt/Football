import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, Trophy, MapPin, Users, Trash2, Search, Check, X, Clock, Goal } from "lucide-react";
import type { EventDetail } from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({ meta: [{ title: "Ereignis" }] }),
  component: EventDetail,
});

type StatusFilter = "all" | "accepted" | "declined" | "pending";

function EventDetail() {
  const { eventId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const eventQ = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.events.get(eventId),
  });

  const attQ = useQuery({
    queryKey: ["event-att", eventId],
    queryFn: () => api.events.attendances(eventId),
  });

  const del = useMutation({
    mutationFn: () => api.events.remove(eventId),
    onSuccess: () => { toast.success("Ereignis gelöscht"); nav({ to: "/events" }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const e = eventQ.data;
  const items = attQ.data ?? [];
  const stats = {
    total: items.length,
    accepted: items.filter((a) => a.status === "accepted").length,
    declined: items.filter((a) => a.status === "declined").length,
    pending: items.filter((a) => a.status === "pending").length,
  };
  const filtered = items.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    const p = a.players;
    const s = search.toLowerCase();
    return !s || `${p?.first_name} ${p?.last_name}`.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Zurück</Link>

      {e && (
        <div className="card-elevated p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className={`h-14 w-14 rounded-2xl grid place-items-center shrink-0 ${e.event_type === "training" ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2"}`}>
                {e.event_type === "training" ? <Activity className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {e.event_type === "training" ? "Training" : `Spiel${e.home_away ? ` · ${e.home_away === "home" ? "Heim" : "Auswärts"}` : ""}`}
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                  {e.title}{e.opponent ? `` : ""}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {format(new Date(e.event_at), "EEEE, d. MMMM yyyy · HH:mm", { locale: de })} Uhr</span>
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {e.groups?.name}</span>
                </div>
                {e.description && <p className="text-sm mt-3">{e.description}</p>}
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Ereignis löschen?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate()}>Löschen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {e && e.event_type === "game" && new Date(e.event_at).getTime() - Date.now() <= 60 * 60 * 1000 && (
        <div className="card-elevated p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Ergebnis</h2>
            {e.home_score != null && e.away_score != null ? (
              <div className="text-2xl font-black tracking-tight">
                {e.home_score}:{e.away_score}
                <span className="text-sm font-medium text-muted-foreground ml-2">
                  {e.home_away === "home" ? "Heim" : e.home_away === "away" ? "Auswärts" : ""}
                </span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Noch kein Ergebnis eingetragen.</div>
            )}
          </div>
          <ResultDialog event={e} onSaved={() => qc.invalidateQueries({ queryKey: ["event", eventId] })} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip label="Gesamt" value={stats.total} className="bg-secondary" />
        <StatChip label="Zugesagt" value={stats.accepted} className="bg-primary/15 text-primary" />
        <StatChip label="Abgesagt" value={stats.declined} className="bg-destructive/15 text-destructive" />
        <StatChip label="Offen" value={stats.pending} className="bg-warning/15 text-warning" />
      </div>

      <div className="card-elevated p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="accepted">Zugesagt</TabsTrigger>
              <TabsTrigger value="declined">Abgesagt</TabsTrigger>
              <TabsTrigger value="pending">Offen</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spieler…" className="pl-9" />
          </div>
        </div>

        {attQ.isLoading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Lädt…</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center text-xs font-bold shrink-0">
                  {a.players?.first_name[0]}{a.players?.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.players?.first_name} {a.players?.last_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.players?.player_code}</div>
                </div>
                <StatusPill status={a.status} onChange={async (s) => {
                  try {
                    await api.attendances.setStatus(a.id, s);
                    qc.invalidateQueries({ queryKey: ["event-att", eventId] });
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultDialog({ event, onSaved }: { event: EventDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const isAway = event.home_away === "away";
  const [ownGoals, setOwnGoals] = useState(String((isAway ? event.away_score : event.home_score) ?? ""));
  const [oppGoals, setOppGoals] = useState(String((isAway ? event.home_score : event.away_score) ?? ""));

  const m = useMutation({
    mutationFn: () => {
      const own = ownGoals.trim() === "" ? null : Number(ownGoals);
      const opp = oppGoals.trim() === "" ? null : Number(oppGoals);
      return api.events.setResult(event.id, {
        homeScore: isAway ? opp : own,
        awayScore: isAway ? own : opp,
      });
    },
    onSuccess: () => { toast.success("Ergebnis gespeichert"); setOpen(false); onSaved(); },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Goal className="h-4 w-4 mr-1" /> {event.home_score != null ? "Bearbeiten" : "Ergebnis eintragen"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Ergebnis eintragen</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center gap-3">
          <div className="space-y-1 text-center">
            <div className="text-xs text-muted-foreground">Unsere Tore</div>
            <Input type="number" min="0" step="1" value={ownGoals} onChange={(ev) => setOwnGoals(ev.target.value)} className="w-16 text-center" />
          </div>
          <span className="text-muted-foreground mt-4">:</span>
          <div className="space-y-1 text-center">
            <div className="text-xs text-muted-foreground">Tore Gegner</div>
            <Input type="number" min="0" step="1" value={oppGoals} onChange={(ev) => setOppGoals(ev.target.value)} className="w-16 text-center" />
          </div>
        </div>
        <Button className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>Speichern</Button>
      </DialogContent>
    </Dialog>
  );
}

function StatChip({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-xl p-4 ${className}`}>
      <div className="text-xs opacity-75 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function StatusPill({ status, onChange }: { status: string; onChange: (s: "accepted" | "declined" | "pending") => void }) {
  const btn = (active: boolean, tone: "ok" | "no" | "n") => {
    const base = "h-8 px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition";
    if (!active) return `${base} bg-secondary text-muted-foreground hover:text-foreground`;
    if (tone === "ok") return `${base} bg-primary text-primary-foreground shadow-glow`;
    if (tone === "no") return `${base} bg-destructive text-destructive-foreground`;
    return `${base} bg-warning/20 text-warning`;
  };
  return (
    <div className="flex gap-1">
      <button className={btn(status === "accepted", "ok")} onClick={() => onChange("accepted")}>
        <Check className="h-3.5 w-3.5" /> Anwesend
      </button>
      <button className={btn(status === "declined", "no")} onClick={() => onChange("declined")}>
        <X className="h-3.5 w-3.5" /> Fehlt
      </button>
      <button className={btn(status === "pending", "n")} onClick={() => onChange("pending")} title="Offen">
        <Clock className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
