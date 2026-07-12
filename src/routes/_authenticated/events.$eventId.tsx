import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, Trophy, MapPin, Users, Trash2, Search, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({ meta: [{ title: "Ereignis" }] }),
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "accepted" | "declined" | "pending">("all");

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
    const p: any = a.players;
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
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(e.groups as any)?.name}</span>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip label="Gesamt" value={stats.total} className="bg-secondary" />
        <StatChip label="Zugesagt" value={stats.accepted} className="bg-primary/15 text-primary" />
        <StatChip label="Abgesagt" value={stats.declined} className="bg-destructive/15 text-destructive" />
        <StatChip label="Offen" value={stats.pending} className="bg-warning/15 text-warning" />
      </div>

      <div className="card-elevated p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
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
            {filtered.map((a: any) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center text-xs font-bold shrink-0">
                  {a.players.first_name[0]}{a.players.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.players.first_name} {a.players.last_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.players.player_code}</div>
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
