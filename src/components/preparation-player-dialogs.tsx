import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ImageOff, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, type PlayerPreparationUnit } from "@/lib/api-client";
import { compressImage } from "@/lib/image-compress";
import { formatKm, unitLabel } from "@/lib/preparation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type UnitTarget = { unit: PlayerPreparationUnit; title: string };

const describe = (t: UnitTarget) => `${t.title} · ${unitLabel(t.unit.week_number, t.unit.run_number)} · ${formatKm(Number(t.unit.distance_km))} km`;

const DIALOG = "flex flex-col max-w-md w-[calc(100%-2rem)] max-h-[90dvh] rounded-xl p-4 sm:p-6 gap-4";

// "Erledigt": Screenshot hochladen (Pflicht; am Handy Kamera oder Galerie) und optional beschreiben,
// was gelaufen wurde. Nach dem Bestätigen ist der Lauf fest.
export function PreparationDoneDialog({ target, open, saving, onClose, onSubmit }: {
  target: UnitTarget | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (image: string, description: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setImage(null);
      setDescription("");
      setProcessing(false);
    }
  }, [open, target?.unit.id]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      setImage(await compressImage(file));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setProcessing(false);
      // Gleiche Datei nochmal wählbar machen.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={DIALOG}>
        <DialogHeader className="text-left pr-6">
          <DialogTitle>Lauf erledigt</DialogTitle>
          <DialogDescription>{target ? describe(target) : ""}</DialogDescription>
        </DialogHeader>

        {/* Ohne "capture": das Handy bietet Kamera und Galerie an. */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        <div className="space-y-2 min-h-0">
          <Label>Screenshot deines Laufs</Label>
          {image ? (
            <div className="space-y-2">
              <img src={image} alt="Vorschau deines Lauf-Screenshots" className="w-full max-h-[34dvh] object-contain rounded-lg bg-secondary" />
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={processing || saving} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-1" /> Anderes Bild wählen
              </Button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={processing}
              className="w-full h-36 rounded-lg border-2 border-dashed border-pink-500/40 bg-pink-500/5 hover:bg-pink-500/10 transition grid place-items-center text-sm text-muted-foreground">
              <span className="flex flex-col items-center gap-2">
                {processing ? <Loader2 className="h-6 w-6 animate-spin text-pink-400" /> : <ImagePlus className="h-6 w-6 text-pink-400" />}
                {processing ? "Bild wird vorbereitet…" : "Bild hochladen"}
              </span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prep-description">Beschreibung (optional)</Label>
          <Textarea id="prep-description" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="z. B. 5,2 km in 31 Minuten, locker gelaufen" />
        </div>

        <p className="text-xs text-muted-foreground">Nach dem Bestätigen kannst du den Lauf nicht mehr ändern.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button type="button" className="shadow-glow" disabled={!image || processing || saving} onClick={() => image && onSubmit(image, description.trim())}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Bestätigen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// "Absagen": Begründung ist Pflicht – der Trainer sieht sie.
export function PreparationDeclineDialog({ target, open, saving, onClose, onSubmit }: {
  target: UnitTarget | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open, target?.unit.id]);
  const valid = reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={DIALOG}>
        <DialogHeader className="text-left pr-6">
          <DialogTitle>Lauf absagen</DialogTitle>
          <DialogDescription>{target ? describe(target) : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="prep-reason">Warum kannst du nicht?</Label>
          <Textarea id="prep-reason" rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. erkältet, Knie tut weh …" />
          <p className="text-xs text-muted-foreground">Dein Trainer sieht die Begründung. Läufst du diese Woche doch noch, kannst du den Lauf danach trotzdem als erledigt melden.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button type="button" variant="destructive" disabled={!valid || saving} onClick={() => onSubmit(reason.trim())}>
            <X className="h-4 w-4 mr-1" /> Absagen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Eigenen eingereichten Lauf nur lesen.
export function PreparationViewDialog({ code, target, open, onClose }: {
  code: string;
  target: UnitTarget | null;
  open: boolean;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["player-preparation-entry", target?.unit.id],
    queryFn: () => api.player.preparationEntry({ code, unitId: target!.unit.id }),
    enabled: open && !!target,
    gcTime: 0,
  });
  const e = q.data;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={DIALOG}>
        <DialogHeader className="text-left pr-6">
          <DialogTitle>Dein Lauf</DialogTitle>
          <DialogDescription>{target ? describe(target) : ""}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <div className="py-8 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : q.error ? (
          <p className="text-sm text-muted-foreground">{(q.error as Error).message}</p>
        ) : e && (
          <div className="space-y-4 min-h-0">
            {e.confirmed ? (
              <div className="rounded-lg bg-primary/15 text-primary p-3 text-sm font-semibold inline-flex items-center gap-2 w-full"><Check className="h-4 w-4" /> Vom Trainer bestätigt</div>
            ) : (
              <div className="rounded-lg bg-warning/15 text-warning p-3 text-sm font-semibold w-full">Erledigt · wartet auf Prüfung durch den Trainer</div>
            )}
            {e.image ? (
              <img src={e.image} alt="Dein Lauf-Screenshot" className="w-full max-h-[40dvh] object-contain rounded-lg bg-secondary" />
            ) : e.image_removed && (
              <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground flex items-center gap-2">
                <ImageOff className="h-4 w-4 shrink-0" /> Bild nach der Bestätigung gelöscht.
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Beschreibung</Label>
              <p className="text-sm whitespace-pre-wrap break-words">{e.description || <span className="text-muted-foreground">Keine Beschreibung.</span>}</p>
            </div>
          </div>
        )}
        <Button type="button" variant="outline" onClick={onClose}>Schließen</Button>
      </DialogContent>
    </Dialog>
  );
}
