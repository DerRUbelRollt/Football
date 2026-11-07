import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { api, type PaceGroup, type PreparationPlayerRow } from "@/lib/api-client";
import { PACE_GROUPS, PACE_GROUP_META, initials } from "@/lib/preparation";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/preparations/$preparationId/einteilen")({
  head: () => ({ meta: [{ title: "Gruppen einteilen" }] }),
  component: AssignPage,
});

// Schnelles Einteilen aller Spieler in die Gruppen A/B/C – jede Änderung wird sofort gespeichert
// und gilt für alle Ereignisse der Vorbereitung.
function AssignPage() {
  const { preparationId } = Route.useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const prepQ = useQuery({ queryKey: ["preparation", preparationId], queryFn: () => api.preparations.get(preparationId) });
  const q = useQuery({ queryKey: ["preparation-players", preparationId], queryFn: () => api.preparations.players(preparationId) });

  const change = async (player: PreparationPlayerRow, group: PaceGroup) => {
    if (player.pace_group === group) return;
    setSaving(player.id);
    // Sofort anzeigen, bei Fehler zurücksetzen.
    qc.setQueryData<PreparationPlayerRow[]>(["preparation-players", preparationId], (rows) =>
      rows?.map((r) => (r.id === player.id ? { ...r, pace_group: group } : r)));
    try {
      await api.preparations.setPaceGroup(preparationId, player.id, group);
      qc.invalidateQueries({ queryKey: ["preparation", preparationId] });
      qc.invalidateQueries({ queryKey: ["preparation-group", preparationId] });
      qc.invalidateQueries({ queryKey: ["preparation-unit"] });
    } catch (err) {
      toast.error((err as Error).message);
      qc.invalidateQueries({ queryKey: ["preparation-players", preparationId] });
    } finally {
      setSaving(null);
    }
  };

  const rows = q.data ?? [];
  const s = search.toLowerCase();
  const filtered = rows.filter((r) => !s || `${r.first_name} ${r.last_name}`.toLowerCase().includes(s));
  const counts = Object.fromEntries(PACE_GROUPS.map((g) => [g, rows.filter((r) => r.pace_group === g).length])) as Record<PaceGroup, number>;

  return (
    <div className="space-y-6">
      <Link to="/preparations/$preparationId" params={{ preparationId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </Link>

      <div>
        <div className="text-xs uppercase tracking-wider font-medium text-pink-400">{prepQ.data ? `${prepQ.data.title} · ${prepQ.data.group.name}` : "Vorbereitung"}</div>
        <h1 className="text-3xl font-black tracking-tight mt-1">Gruppen einteilen</h1>
        <p className="text-muted-foreground mt-1">
          {PACE_GROUPS.map((g) => `${PACE_GROUP_META[g].label}: ${counts[g]}`).join(" · ")}
        </p>
      </div>

      <div className="card-elevated p-5 sm:p-6 space-y-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spieler…" className="pl-9" />
        </div>
        {q.isLoading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Lädt…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Keine Spieler gefunden.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center text-xs font-bold shrink-0">{initials(r.first_name, r.last_name)}</div>
                <div className="min-w-0 flex-1 font-medium truncate">{r.first_name} {r.last_name}</div>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1 shrink-0" role="radiogroup" aria-label={`Gruppe von ${r.first_name} ${r.last_name}`}>
                  {PACE_GROUPS.map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={r.pace_group === g} title={PACE_GROUP_META[g].label}
                      disabled={saving === r.id} onClick={() => change(r, g)}
                      className={`h-8 w-9 rounded-lg text-sm font-bold transition ${r.pace_group === g ? "bg-pink-500 text-white shadow" : "text-muted-foreground hover:text-foreground"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
