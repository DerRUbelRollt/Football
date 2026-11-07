import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, ChevronRight, Clock, Dumbbell, Gauge, MessageSquareWarning, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, type PlayerPreparation, type PlayerPreparationUnit } from "@/lib/api-client";
import { PACE_GROUP_META, PREP_TONE, formatKm, formatPace, formatWindow, unitLabel } from "@/lib/preparation";
import { EventTypeIcon } from "@/components/event-type-icon";
import { Button } from "@/components/ui/button";
import { PreparationDeclineDialog, PreparationDoneDialog, PreparationViewDialog, type UnitTarget } from "@/components/preparation-player-dialogs";

type DialogState = { kind: "done" | "decline" | "view"; target: UnitTarget; open: boolean } | null;

// Vorbereitungs-Ereignisse auf der Spieler-Übersicht: je Vorbereitung eine pinke Überschrift mit
// dem Namen, darunter klein die Regeln und dann alle noch laufenden Einheiten. Abgelaufene Wochen
// stehen in der Historie.
export function PreparationSections({ code, preparations }: { code: string; preparations: PlayerPreparation[] }) {
  const qc = useQueryClient();
  // Bleibt beim Schließen kurz gefüllt, damit sich der Inhalt während der Animation nicht ändert.
  const [dialog, setDialog] = useState<DialogState>(null);
  const openDialog = (kind: "done" | "decline" | "view", target: UnitTarget) => setDialog({ kind, target, open: true });
  const close = () => setDialog((d) => d && { ...d, open: false });

  const onError = (e: unknown) => {
    toast.error(e instanceof ApiError ? e.message : (e as Error).message);
    qc.invalidateQueries({ queryKey: ["player-overview"] });
  };

  const done = useMutation({
    mutationFn: (vars: { unitId: number; image: string; description: string }) =>
      api.player.preparationDone({ code, unitId: vars.unitId, image: vars.image, description: vars.description || null }),
    onSuccess: () => {
      toast.success("Lauf gemeldet – dein Trainer prüft ihn");
      close();
      qc.invalidateQueries({ queryKey: ["player-overview"] });
    },
    onError,
  });

  const decline = useMutation({
    mutationFn: (vars: { unitId: number; reason: string }) =>
      api.player.preparationDecline({ code, unitId: vars.unitId, reason: vars.reason }),
    onSuccess: () => {
      toast.success("Abgesagt");
      close();
      qc.invalidateQueries({ queryKey: ["player-overview"] });
    },
    onError,
  });

  if (preparations.length === 0) return null;

  return (
    <>
      {preparations.map((p) => (
        <section key={p.id}>
          <h2 className={`font-bold text-lg mb-3 inline-flex items-center gap-2 ${PREP_TONE.text}`}>
            <Dumbbell className="h-5 w-5" /> {p.title}
          </h2>
          {p.rules.length > 0 && (
            <div className={`rounded-xl px-4 py-3 mb-3 ${PREP_TONE.box}`}>
              <ul className="list-disc pl-4 space-y-0.5 text-xs text-muted-foreground marker:text-pink-400">
                {p.rules.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          <div className="space-y-3">
            {p.units.map((u, i) => (
              <UnitCard key={u.id} unit={u} index={i} paceLabel={PACE_GROUP_META[p.pace_group].label}
                busy={done.isPending || decline.isPending}
                onAction={(kind) => openDialog(kind, { unit: u, title: p.title })} />
            ))}
          </div>
        </section>
      ))}

      <PreparationDoneDialog
        target={dialog?.target ?? null}
        open={dialog?.kind === "done" && dialog.open}
        saving={done.isPending}
        onClose={close}
        onSubmit={(image, description) => dialog && done.mutate({ unitId: dialog.target.unit.id, image, description })}
      />
      <PreparationDeclineDialog
        target={dialog?.target ?? null}
        open={dialog?.kind === "decline" && dialog.open}
        saving={decline.isPending}
        onClose={close}
        onSubmit={(reason) => dialog && decline.mutate({ unitId: dialog.target.unit.id, reason })}
      />
      <PreparationViewDialog
        code={code}
        target={dialog?.target ?? null}
        open={dialog?.kind === "view" && dialog.open}
        onClose={close}
      />
    </>
  );
}

function UnitCard({ unit: u, index, paceLabel, busy, onAction }: {
  unit: PlayerPreparationUnit;
  index: number;
  paceLabel: string;
  busy: boolean;
  onAction: (kind: "done" | "decline" | "view") => void;
}) {
  const now = Date.now();
  const notStarted = now < new Date(u.starts_at).getTime();
  const running = !notStarted;
  const declined = u.status === "declined";
  const rejected = u.status === "pending" && !!u.trainer_comment;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.04 }}
      className={`card-elevated p-5 ${running ? PREP_TONE.border : ""} ${notStarted ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-4">
        <EventTypeIcon type="preparation" className="h-12 w-12 rounded-xl" iconClassName="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs uppercase tracking-wider font-medium text-pink-400">{unitLabel(u.week_number, u.run_number)}</div>
            {notStarted && (
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                Ab {format(new Date(u.starts_at), "EEEEEE, dd.MM.", { locale: de })}
              </span>
            )}
          </div>
          <div className="font-bold text-lg mt-0.5">{formatKm(Number(u.distance_km))} km · Pace {formatPace(u.pace_sec)} min/km</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatWindow(u.starts_at, u.ends_at)}</span>
            <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> Gruppe {paceLabel}</span>
          </div>
        </div>
      </div>

      {rejected && (
        <div className="mt-4 rounded-lg bg-orange-500/10 text-orange-400 p-3 text-sm flex gap-2">
          <MessageSquareWarning className="h-4 w-4 shrink-0 mt-0.5" />
          <span><span className="font-semibold">Dein Trainer hat den Lauf nicht bestätigt:</span> {u.trainer_comment}</span>
        </div>
      )}
      {declined && u.decline_reason && (
        <p className="mt-3 text-sm text-destructive"><span className="font-semibold">Abgesagt:</span> {u.decline_reason}</p>
      )}

      {u.status === "done" ? (
        <button type="button" onClick={() => onAction("view")}
          className={`mt-4 w-full flex items-center gap-2 rounded-lg p-3 text-sm font-semibold transition ${u.confirmed ? "bg-primary text-primary-foreground shadow-glow" : "bg-primary/15 text-primary hover:bg-primary/20"}`}>
          <Check className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{u.confirmed ? "Bestätigt" : "Erledigt · wartet auf Prüfung"}</span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button onClick={() => onAction("done")} disabled={busy || notStarted}
            className="bg-secondary text-foreground hover:bg-primary/20"
            title={notStarted ? "Diese Woche hat noch nicht begonnen" : undefined}>
            <Check className="h-4 w-4 mr-1" /> Erledigt
          </Button>
          <Button onClick={() => onAction("decline")} disabled={busy || notStarted || declined}
            variant={declined ? "destructive" : "outline"}
            title={notStarted ? "Diese Woche hat noch nicht begonnen" : undefined}>
            <X className="h-4 w-4 mr-1" /> {declined ? "Abgesagt" : "Absagen"}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
