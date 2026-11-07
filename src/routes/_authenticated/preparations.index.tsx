import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Dumbbell, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { PREP_TONE, formatDateRange } from "@/lib/preparation";
import { PreparationFormDialog } from "@/components/preparation-form-dialog";
import { ReviewBadge } from "@/components/review-badge";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/preparations/")({
  head: () => ({ meta: [{ title: "Vorbereitung" }] }),
  component: PreparationsPage,
});

// Alle Fitness-Vorbereitungen als große Karten (wie die Mannschaften), neueste zuerst.
// Abgeschlossene bleiben in derselben Liste und tragen das Badge "Beendet".
function PreparationsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["preparations"], queryFn: () => api.preparations.list() });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Vorbereitung</h1>
          <p className="text-muted-foreground mt-1">Laufpläne für die Winter- und Sommervorbereitung.</p>
        </div>
        <PreparationFormDialog mode="create" onSaved={(id) => {
          qc.invalidateQueries({ queryKey: ["preparations"] });
          nav({ to: "/preparations/$preparationId", params: { preparationId: String(id) } });
        }} />
      </div>

      {q.isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Lädt…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="card-elevated"><EmptyState title="Noch keine Vorbereitung" hint="Lege einen Laufplan an – für jede Einheit entsteht ein eigenes Vorbereitungs-Ereignis." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {q.data!.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link to="/preparations/$preparationId" params={{ preparationId: String(p.id) }}
                className={`card-elevated p-5 block hover:border-pink-500/50 transition group ${p.ended ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className={`h-11 w-11 rounded-xl grid place-items-center ${PREP_TONE.iconRing}`}>
                    <Dumbbell className="h-5 w-5 text-pink-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.to_review > 0 && <ReviewBadge count={p.to_review} />}
                    {p.ended && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Beendet</span>}
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-pink-400 group-hover:translate-x-1 transition" />
                  </div>
                </div>
                <h3 className="mt-4 font-bold text-lg">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.group.name}</p>
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDateRange(p.start_date, p.end_date)}</span>
                  <span>{p.units_count} Einheiten</span>
                  <span>{p.player_count} Spieler</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
