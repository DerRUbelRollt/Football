import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Clock, Dumbbell } from "lucide-react";
import { api, type PaceGroup } from "@/lib/api-client";
import { PACE_GROUPS, PACE_GROUP_META, PREP_TONE, formatKm, formatPace, formatWindow, unitLabel } from "@/lib/preparation";
import { ReviewBadge } from "@/components/review-badge";

export const Route = createFileRoute("/_authenticated/preparations/$preparationId/$group/")({
  head: () => ({ meta: [{ title: "Vorbereitung" }] }),
  component: GroupPage,
});

const toPaceGroup = (g: string): PaceGroup | null => {
  const up = g.toUpperCase();
  return (PACE_GROUPS as string[]).includes(up) ? (up as PaceGroup) : null;
};

// Ordner einer Gruppe: alle Vorbereitungs-Ereignisse mit den Zählern der Spieler dieser Gruppe.
// Die laufende Woche ist hervorgehoben, vergangene Wochen sind gedimmt.
function GroupPage() {
  const { preparationId, group: rawGroup } = Route.useParams();
  const group = toPaceGroup(rawGroup);
  const q = useQuery({
    queryKey: ["preparation-group", preparationId, group],
    queryFn: () => api.preparations.group(preparationId, group!),
    enabled: !!group,
  });

  if (!group) {
    return <div className="card-elevated p-6 text-sm text-muted-foreground">Unbekannte Gruppe.</div>;
  }

  const d = q.data;
  const now = Date.now();
  return (
    <div className="space-y-6">
      <Link to="/preparations/$preparationId" params={{ preparationId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </Link>

      <div>
        <div className="text-xs uppercase tracking-wider font-medium text-pink-400">{d ? `${d.preparation.title} · ${d.preparation.group.name}` : "Vorbereitung"}</div>
        <h1 className="text-3xl font-black tracking-tight mt-1">{PACE_GROUP_META[group].label}</h1>
        {d && <p className="text-muted-foreground mt-1">{d.players} Spieler · {d.units.length} Ereignisse</p>}
      </div>

      {q.isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Lädt…</div>
      ) : q.error ? (
        <div className="card-elevated p-6 text-sm text-muted-foreground">{(q.error as Error).message}</div>
      ) : (
        <div className="space-y-2">
          {d!.units.map((u, i) => {
            const running = new Date(u.starts_at).getTime() <= now && now < new Date(u.ends_at).getTime();
            const past = now >= new Date(u.ends_at).getTime();
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}>
                <Link to="/preparations/$preparationId/$group/$unitId" params={{ preparationId, group, unitId: String(u.id) }}
                  className={`card-elevated p-4 flex items-center gap-4 hover:border-pink-500/50 transition group ${running ? "border-pink-500/60 ring-1 ring-pink-500/30" : ""} ${past ? "opacity-60" : ""}`}>
                  <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${PREP_TONE.icon}`}><Dumbbell className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{unitLabel(u.week_number, u.run_number)}</span>
                      {running && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400">Diese Woche</span>}
                      <ReviewBadge count={u.to_review} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatWindow(u.starts_at, u.ends_at)}</span>
                      <span>{formatKm(Number(u.distance_km))} km · {formatPace(u.pace_sec)} min/km</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{u.done}/{u.total}</div>
                    <div className="text-[11px] text-muted-foreground">erledigt</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-pink-400 group-hover:translate-x-1 transition shrink-0" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
