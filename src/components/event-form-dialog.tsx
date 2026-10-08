import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type EventDetail, type NewEvent } from "@/lib/api-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Props =
  | { mode: "create"; onSaved: () => void }
  | { mode: "edit"; event: EventDetail; onSaved: () => void };

// Dialog zum Erstellen und Bearbeiten von Ereignissen. Beim Bearbeiten ist der Typ fest
// und die wöchentliche Wiederholung entfällt.
export function EventFormDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"training" | "game">("training");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [homeAway, setHomeAway] = useState<"home" | "away">("home");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [meeting, setMeeting] = useState("");
  const [desc, setDesc] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState(4);

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.groups.list(),
    enabled: open,
  });

  const onOpenChange = (next: boolean) => {
    // Beim Öffnen im Bearbeiten-Modus immer den aktuellen Stand des Ereignisses übernehmen.
    if (next && props.mode === "edit") {
      const e = props.event;
      const when = new Date(e.event_at);
      setType(e.event_type);
      setGroupId(String(e.group_id));
      // Bei Spielen wird der Titel automatisch aus dem Gegner gebildet; nur eigene Titel übernehmen.
      setTitle(e.event_type === "game" && e.title === `Spiel gegen ${e.opponent ?? ""}` ? "" : e.title);
      setOpponent(e.opponent ?? "");
      setHomeAway(e.home_away ?? "home");
      setDate(format(when, "yyyy-MM-dd"));
      setTime(format(when, "HH:mm"));
      setLocation(e.location ?? "");
      setMeeting(e.meeting_point ?? "");
      setDesc(e.description ?? "");
    }
    setOpen(next);
  };

  const m = useMutation({
    mutationFn: async () => {
      const base = new Date(`${date}T${time}`);
      const count = !isEdit && type === "training" && recurring ? Math.max(1, Math.min(52, weeks)) : 1;
      const rows: NewEvent[] = Array.from({ length: count }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() + i * 7);
        return {
          eventType: type,
          title: title || (type === "training" ? "Training" : `Spiel gegen ${opponent}`),
          opponent: type === "game" ? opponent : null,
          homeAway: type === "game" ? homeAway : null,
          location: location || null,
          meetingPoint: meeting || null,
          eventAt: d.toISOString(),
          description: desc || null,
          groupId: Number(groupId),
        };
      });
      if (props.mode === "edit") {
        const { eventType: _eventType, ...update } = rows[0];
        await api.events.update(props.event.id, update);
        return 1;
      }
      const { count: created } = await api.events.create(rows);
      return created;
    },
    onSuccess: (n) => {
      if (isEdit) {
        toast.success("Ereignis gespeichert");
      } else {
        toast.success(n && n > 1 ? `${n} Trainings erstellt` : "Ereignis erstellt");
        setTitle(""); setOpponent(""); setDate(""); setLocation(""); setMeeting(""); setDesc("");
        setRecurring(false); setWeeks(4);
      }
      setOpen(false);
      props.onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="icon" title="Bearbeiten"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button className="shadow-glow"><Plus className="h-4 w-4 mr-1" /> Ereignis</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Ereignis bearbeiten" : "Neues Ereignis"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["training", "game"] as const).map((t) => (
              <button type="button" key={t} onClick={() => setType(t)} disabled={isEdit}
                title={isEdit ? "Der Typ kann nachträglich nicht geändert werden" : undefined}
                className={`h-10 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed ${type === t ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"}`}>
                {t === "training" ? "Training" : "Spiel"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Mannschaft</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
              <SelectContent>
                {(groupsQ.data ?? []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {type === "training" ? (
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Techniktraining" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Gegner</Label>
                <Input required value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="SV Musterhausen" />
              </div>
              <div className="space-y-2">
                <Label>Heim / Auswärts</Label>
                <Select value={homeAway} onValueChange={(v) => setHomeAway(v as "home" | "away")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Heim</SelectItem>
                    <SelectItem value="away">Auswärts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Datum</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Uhrzeit</Label>
              <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {!isEdit && type === "training" && (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(!!v)} />
                <span className="text-sm font-medium">Wöchentlich wiederholen</span>
              </label>
              {recurring && (
                <div className="space-y-2">
                  <Label>Anzahl Wochen</Label>
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={weeks}
                    onChange={(e) => setWeeks(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Erstellt {Math.max(1, Math.min(52, weeks))} Trainings am selben Wochentag & Uhrzeit.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ort</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sportplatz" />
            </div>
            <div className="space-y-2">
              <Label>Treffpunkt</Label>
              <Input value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="Vereinsheim" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending || !groupId}>{isEdit ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
