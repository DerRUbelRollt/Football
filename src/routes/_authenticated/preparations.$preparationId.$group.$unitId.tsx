import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Clock, Dumbbell, Gauge, Search, Users } from "lucide-react";
import { api, type PaceGroup, type PreparationStatus, type PreparationUnitRow } from "@/lib/api-client";
import { PACE_GROUPS, PACE_GROUP_META, PREP_TONE, formatKm, formatPace, formatWindow, initials, unitLabel } from "@/lib/preparation";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { PreparationEntryDialog } from "@/components/preparation-entry-dialog";

export const Route = createFileRoute("/_authenticated/preparations/$preparationId/$group/$unitId")({
  head: () => ({ meta: [{ title: "Vorbereitungs-Ereignis" }] }),
  component: UnitPage,
});

type Filter = "all" | "done" | "not_done" | "pending";

// Die drei Status-Buttons zeigen den Stand nur an: erledigt ✓, abgesagt/verpasst ✗, offen ⏱.
const PILL_STATUS: Record<PreparationStatus, "accepted" | "declined" | "pending"> = {
  done: "accepted",
  declined: "declined",
  missed: "declined",
  pending: "pending",
};

const matchesFilter = (status: PreparationStatus, filter: Filter) =>
  filter === "all"
  || (filter === "done" && status === "done")
  || (filter === "not_done" && (status === "declined" || status === "missed"))
  || (filter === "pending" && status === "pending");

// Ein Vorbereitungs-Ereignis aus Trainer-Sicht – aufgebaut wie ein normales Ereignis, aber die
// Spieler melden selbst. Ein Klick auf einen Spieler öffnet seinen Lauf (oder seine Absage).
function UnitPage() {
  const { preparationId, group: rawGroup, unitId } = Route.useParams();
  const up = rawGroup.toUpperCase();
  const group = (PACE_GROUPS as string[]).includes(up) ? (up as PaceGroup) : null;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<PreparationUnitRow["player"] | null>(null);

  const q = useQuery({
    queryKey: ["preparation-unit", unitId, group],
    queryFn: () => api.preparations.unit(unitId, group!),
    enabled: !!group,
  });

  if (!group) return <div className="card-elevated p-6 text-sm text-muted-foreground">Unbekannte Gruppe.</div>;

  const u = q.data;
  const rows = u?.rows ?? [];
  const stats = {
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
    notDone: rows.filter((r) => r.status === "declined" || r.status === "missed").length,
    open: rows.filter((r) => r.status === "pending").length,
  };
  const s = search.toLowerCase();
  const filtered = rows.filter((r) => matchesFilter(r.status, filter)
    && (!s || `${r.player.first_name} ${r.player.last_name}`.toLowerCase().includes(s)));

  return (
    <div className="space-y-6">
      <Link to="/preparations/$preparationId/$group" params={{ preparationId, group }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </Link>

      {u && (
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className={`h-14 w-14 rounded-2xl grid place-items-center shrink-0 ${PREP_TONE.icon}`}><Dumbbell className="h-6 w-6" /></div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider font-medium text-pink-400">{u.preparation.title} · Gruppe {PACE_GROUP_META[group].label}</div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{unitLabel(u.week_number, u.run_number)}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatWindow(u.starts_at, u.ends_at)}</span>
                <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> {formatKm(Number(u.distance_km))} km · Pace {formatPace(u.pace_sec)} min/km</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {u.preparation.group.name}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip label="Gesamt" value={stats.total} className="bg-secondary" />
        <StatChip label="Erledigt" value={stats.done} className="bg-primary/15 text-primary" />
        <StatChip label="Nicht erledigt" value={stats.notDone} className="bg-destructive/15 text-destructive" />
        <StatChip label="Offen" value={stats.open} className="bg-warning/15 text-warning" />
      </div>

      <div className="card-elevated p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="done">Erledigt</TabsTrigger>
              <TabsTrigger value="not_done">Nicht erledigt</TabsTrigger>
              <TabsTrigger value="pending">Offen</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spieler…" className="pl-9" />
          </div>
        </div>

        {q.isLoading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Lädt…</div>
        ) : q.error ? (
          <div className="py-10 text-center text-muted-foreground text-sm">{(q.error as Error).message}</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">{rows.length === 0 ? "In dieser Gruppe ist noch kein Spieler." : "Keine Spieler in dieser Ansicht."}</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.player.id}>
                <button type="button" onClick={() => setSelected(r.player)}
                  className="w-full flex items-center gap-3 py-3 text-left rounded-lg hover:bg-secondary/50 transition px-1 -mx-1">
                  {/* Grünes Kürzel = vom Trainer bestätigt. */}
                  <div className={`h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${r.confirmed ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary"}`}>
                    {initials(r.player.first_name, r.player.last_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.player.first_name} {r.player.last_name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono">{r.player.player_code}</span>
                      <RowHint row={r} />
                    </div>
                  </div>
                  <StatusPill status={PILL_STATUS[r.status]} readOnly />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PreparationEntryDialog preparationId={preparationId} unitId={unitId} player={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function RowHint({ row }: { row: PreparationUnitRow }) {
  if (row.status === "done") {
    return row.confirmed
      ? <span className="text-primary">Bestätigt</span>
      : <span className="text-warning">Wartet auf Prüfung</span>;
  }
  if (row.status === "declined") return <span className="text-destructive">Abgesagt</span>;
  if (row.status === "missed") return <span className="text-destructive">Verpasst</span>;
  if (row.rejected) return <span className="text-orange-400">Nicht bestätigt</span>;
  return null;
}

function StatChip({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-xl p-4 ${className}`}>
      <div className="text-xs opacity-75 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}
