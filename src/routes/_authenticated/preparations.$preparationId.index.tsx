import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Dumbbell, Trash2, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { api, type PreparationDetail } from "@/lib/api-client";
import { PACE_GROUPS, PACE_GROUP_META, PREP_TONE, formatDateRange, formatKm, formatPace, formatShortRange } from "@/lib/preparation";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PreparationFormDialog } from "@/components/preparation-form-dialog";
import { ReviewBadge } from "@/components/review-badge";

export const Route = createFileRoute("/_authenticated/preparations/$preparationId/")({
  head: () => ({ meta: [{ title: "Vorbereitung" }] }),
  component: PreparationPage,
});

// Eine Vorbereitung: Kopf mit Aktionen, einklappbarer Plan und die drei Gruppen-Ordner A/B/C.
function PreparationPage() {
  const { preparationId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["preparation", preparationId], queryFn: () => api.preparations.get(preparationId) });

  const del = useMutation({
    mutationFn: () => api.preparations.remove(preparationId),
    onSuccess: () => {
      toast.success("Vorbereitung gelöscht");
      qc.invalidateQueries({ queryKey: ["preparations"] });
      nav({ to: "/preparations" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const p = q.data;
  return (
    <div className="space-y-6">
      <Link to="/preparations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Zurück</Link>

      {q.isLoading && <div className="py-12 text-center text-muted-foreground">Lädt…</div>}
      {q.error && <div className="card-elevated p-6 text-sm text-muted-foreground">{(q.error as Error).message}</div>}

      {p && (
        <>
          <div className="card-elevated p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className={`h-14 w-14 rounded-2xl grid place-items-center shrink-0 ${PREP_TONE.icon}`}><Dumbbell className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider font-medium text-pink-400">
                    Vorbereitung{p.ended && " · Beendet"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{p.title}</h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.group.name}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDateRange(p.start_date, p.end_date)}</span>
                    <span>{p.weeks_count} {p.weeks_count === 1 ? "Woche" : "Wochen"} · {p.runs_per_week} {p.runs_per_week === 1 ? "Lauf" : "Läufe"}/Woche · {p.units_count} Einheiten</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link to="/preparations/$preparationId/einteilen" params={{ preparationId }}>
                    <UsersRound className="h-4 w-4 mr-1" /> Gruppen einteilen
                  </Link>
                </Button>
                <PreparationFormDialog mode="edit" preparation={p} onSaved={() => {
                  qc.invalidateQueries({ queryKey: ["preparation", preparationId] });
                  qc.invalidateQueries({ queryKey: ["preparations"] });
                  qc.invalidateQueries({ queryKey: ["preparation-group", preparationId] });
                }} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Löschen"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[calc(100%-2rem)] rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Vorbereitung löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Alle {p.units_count} Vorbereitungs-Ereignisse, Rückmeldungen und Bilder von „{p.title}“ werden gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => del.mutate()}>Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          <PlanOverview preparation={p} />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PACE_GROUPS.map((g, i) => {
              const stats = p.pace_groups[g];
              const first = p.weeks[0]?.pace[g];
              const last = p.weeks[p.weeks.length - 1]?.pace[g];
              return (
                <motion.div key={g} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link to="/preparations/$preparationId/$group" params={{ preparationId, group: g }}
                    className="card-elevated p-5 block hover:border-pink-500/50 transition group">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`h-11 w-11 rounded-xl grid place-items-center text-lg font-black text-pink-400 ${PREP_TONE.iconRing}`}>{g}</div>
                      <div className="flex items-center gap-1.5">
                        <ReviewBadge count={stats.to_review} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-pink-400 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                    <h3 className="mt-4 font-bold text-lg">{PACE_GROUP_META[g].label}</h3>
                    {first !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Pace {formatPace(first)}{last !== first ? ` → ${formatPace(last)}` : ""} min/km
                      </p>
                    )}
                    <div className="mt-4 text-xs text-muted-foreground">{stats.players} Spieler · {p.units_count} Ereignisse</div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Der komplette Plan wie im Vorbereitungs-PDF: Distanzen je Lauf, Pace je Gruppe und Regeln.
function PlanOverview({ preparation: p }: { preparation: PreparationDetail }) {
  const [open, setOpen] = useState(false);
  const runs = Array.from({ length: p.runs_per_week }, (_, r) => r + 1);
  const th = "text-left font-semibold px-3 py-2 whitespace-nowrap";
  const td = "px-3 py-2 whitespace-nowrap tabular-nums";
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-elevated">
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 p-5 text-left">
        <span className="font-bold">Plan anzeigen</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pb-5 space-y-5">
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Trainingsplan</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-pink-500/15 text-pink-400">
                <tr>
                  <th className={th}>Woche</th>
                  {runs.map((r) => <th key={r} className={th}>Lauf {r}</th>)}
                  <th className={th}>Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.weeks.map((w) => (
                  <tr key={w.number} className="even:bg-secondary/40">
                    <td className={td}>{w.number} <span className="text-xs text-muted-foreground">· {formatShortRange(new Date(w.starts_at), new Date(w.ends_at))}</span></td>
                    {w.units.map((u) => <td key={u.id} className={td}>{formatKm(Number(u.distance_km))} km</td>)}
                    <td className={`${td} font-semibold`}>{formatKm(w.units.reduce((s, u) => s + Number(u.distance_km), 0))} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Pace nach Gruppe (min/km)</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-pink-500/15 text-pink-400">
                <tr>
                  <th className={th}>Woche</th>
                  {PACE_GROUPS.map((g) => <th key={g} className={th}>{PACE_GROUP_META[g].label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.weeks.map((w) => (
                  <tr key={w.number} className="even:bg-secondary/40">
                    <td className={td}>{w.number}</td>
                    {PACE_GROUPS.map((g) => <td key={g} className={td}>{formatPace(w.pace[g])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {p.rules.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Regeln für alle Spieler</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {p.rules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
