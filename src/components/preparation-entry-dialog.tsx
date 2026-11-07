import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageOff, Maximize2, MessageSquareWarning, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { api, type PaceGroup } from "@/lib/api-client";
import { PACE_GROUPS, PACE_GROUP_META } from "@/lib/preparation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  preparationId: string;
  unitId: string;
  player: { id: number; first_name: string; last_name: string } | null;
  onClose: () => void;
};

// Spieler-Dialog des Trainers in einem Vorbereitungs-Ereignis: Screenshot und Beschreibung (bzw.
// Absage-Begründung), Laufintensität A/B/C und – bei erledigten Läufen – "Bestätigt" / "Nicht bestätigt".
// Ein Gruppenwechsel wird erst beim Schließen gespeichert; dann wandert der Spieler in den anderen Ordner.
export function PreparationEntryDialog({ preparationId, unitId, player, onClose }: Props) {
  const qc = useQueryClient();
  const open = !!player;
  const [paceGroup, setPaceGroup] = useState<PaceGroup | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [zoom, setZoom] = useState(false);
  const [closing, setClosing] = useState(false);

  const q = useQuery({
    queryKey: ["preparation-entry", unitId, player?.id],
    queryFn: () => api.preparations.entry(unitId, player!.id),
    enabled: open,
    // Immer frisch laden – das Bild kann inzwischen gelöscht oder neu eingereicht sein.
    gcTime: 0,
  });
  const e = q.data;

  useEffect(() => {
    if (!open) return;
    setRejecting(false);
    setComment("");
    setZoom(false);
    setClosing(false);
    setPaceGroup(null);
  }, [open, player?.id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["preparation-unit"] });
    qc.invalidateQueries({ queryKey: ["preparation-group", preparationId] });
    qc.invalidateQueries({ queryKey: ["preparation", preparationId] });
    qc.invalidateQueries({ queryKey: ["preparations"] });
  };

  // Beim Schließen (egal wie) einen geänderten Gruppenwechsel speichern.
  const finish = async () => {
    if (closing) return;
    setClosing(true);
    if (player && e && paceGroup && paceGroup !== e.pace_group) {
      try {
        await api.preparations.setPaceGroup(preparationId, player.id, paceGroup);
        toast.success(`${player.first_name} ist jetzt in Gruppe ${PACE_GROUP_META[paceGroup].label}`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
    refresh();
    onClose();
  };

  const review = useMutation({
    mutationFn: (decision: "confirm" | "reject") =>
      api.preparations.review(unitId, player!.id, { decision, comment: decision === "reject" ? comment.trim() : null }),
    onSuccess: async (_, decision) => {
      toast.success(decision === "confirm" ? "Lauf bestätigt" : "Lauf nicht bestätigt – der Spieler sieht deinen Kommentar");
      await finish();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const name = player ? `${player.first_name} ${player.last_name}` : "";
  const currentGroup = paceGroup ?? e?.pace_group ?? null;
  const isDone = e?.status === "done";

  const statusLine = !e ? "Lädt…"
    : e.status === "done" ? (e.confirmed ? "Erledigt · bestätigt" : "Erledigt · wartet auf deine Prüfung")
    : e.status === "declined" ? "Abgesagt"
    : e.status === "missed" ? "Verpasst – die Woche ist vorbei"
    : "Offen – noch nichts eingereicht";

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) void finish(); }}>
        <DialogContent className="flex flex-col max-w-md w-[calc(100%-2rem)] max-h-[90dvh] rounded-xl p-4 sm:p-6 gap-4">
          <DialogHeader className="text-left pr-6">
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>
              {statusLine}
              {e?.submitted_at && (e.status === "done" || e.status === "declined") && ` · ${format(new Date(e.submitted_at), "EEEEEE dd.MM., HH:mm", { locale: de })} Uhr`}
            </DialogDescription>
          </DialogHeader>

          {e && (
            <div className="space-y-4 min-h-0">
              {isDone && !rejecting && (
                e.image ? (
                  <button type="button" onClick={() => setZoom(true)} className="relative block w-full rounded-lg bg-secondary overflow-hidden group" title="Vergrößern">
                    <img src={e.image} alt={`Lauf-Nachweis von ${name}`} className="w-full max-h-[40dvh] object-contain" />
                    <span className="absolute right-2 bottom-2 rounded-md bg-background/80 p-1.5 opacity-80 group-hover:opacity-100"><Maximize2 className="h-4 w-4" /></span>
                  </button>
                ) : (
                  <div className="rounded-lg bg-secondary p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <ImageOff className="h-4 w-4 shrink-0" /> Bild wurde nach der Prüfung gelöscht.
                  </div>
                )
              )}

              {isDone && !rejecting && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                  <p className="text-sm whitespace-pre-wrap break-words">{e.description || <span className="text-muted-foreground">Keine Beschreibung.</span>}</p>
                </div>
              )}

              {isDone && rejecting && (
                <div className="space-y-2">
                  <Label htmlFor="reject-comment">Kommentar für {player?.first_name}</Label>
                  <Textarea id="reject-comment" autoFocus rows={4} maxLength={500} value={comment} onChange={(ev) => setComment(ev.target.value)}
                    placeholder="z. B. Auf dem Screenshot fehlt die Distanz – bitte nochmal hochladen." />
                  <p className="text-xs text-muted-foreground">Bild und Text werden gelöscht. {player?.first_name} sieht deinen Kommentar und kann den Lauf neu einreichen, solange die Woche läuft.</p>
                </div>
              )}

              {e.status === "declined" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Begründung der Absage</Label>
                  <p className="text-sm whitespace-pre-wrap break-words rounded-lg bg-destructive/10 p-3">{e.decline_reason || "–"}</p>
                </div>
              )}

              {(e.status === "pending" || e.status === "missed") && e.trainer_comment && (
                <div className="rounded-lg bg-orange-500/10 text-orange-400 p-3 text-sm flex gap-2">
                  <MessageSquareWarning className="h-4 w-4 shrink-0 mt-0.5" />
                  <span><span className="font-semibold">Nicht bestätigt:</span> {e.trainer_comment}</span>
                </div>
              )}

              {!rejecting && (
                <div className="space-y-2">
                  <Label>Laufintensität</Label>
                  <Select value={currentGroup ?? undefined} onValueChange={(v) => setPaceGroup(v as PaceGroup)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PACE_GROUPS.map((g) => <SelectItem key={g} value={g}>{PACE_GROUP_META[g].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {paceGroup && paceGroup !== e.pace_group && (
                    <p className="text-xs text-muted-foreground">Wird beim Schließen übernommen – für alle Ereignisse dieser Vorbereitung.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {e && isDone && (
            rejecting ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setRejecting(false)} disabled={review.isPending}>Abbrechen</Button>
                <Button variant="destructive" disabled={review.isPending || !comment.trim()} onClick={() => review.mutate("reject")}>Absenden</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRejecting(true)} disabled={review.isPending}>
                  <X className="h-4 w-4 mr-1" /> Nicht bestätigt
                </Button>
                <Button className="shadow-glow" onClick={() => review.mutate("confirm")} disabled={review.isPending || e.confirmed}>
                  <Check className="h-4 w-4 mr-1" /> Bestätigt
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Screenshot in voller Größe */}
      <Dialog open={zoom && !!e?.image} onOpenChange={setZoom}>
        <DialogContent className="max-w-[95vw] w-auto p-2 rounded-xl">
          <DialogTitle className="sr-only">Lauf-Nachweis von {name}</DialogTitle>
          {e?.image && <img src={e.image} alt={`Lauf-Nachweis von ${name}`} className="max-h-[88dvh] max-w-[92vw] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
