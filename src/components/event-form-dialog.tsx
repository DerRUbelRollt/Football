import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type EventDetail, type EventType, type NewEvent } from "@/lib/api-client";
import { EVENT_TYPE_META } from "@/lib/event-type";
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
import { format, isValid, parse, subMinutes } from "date-fns";

type Props =
  | { mode: "create"; onSaved: () => void }
  | { mode: "edit"; event: EventDetail; onSaved: () => void };

// Ort, der bei Heimspielen automatisch eingetragen wird.
const HOME_LOCATION = "Neunkircher Str. 7A, 66333 Völklingen";

const DEFAULT_TIME = "18:00";
const DEFAULT_MAX_GUESTS = 1;

// Bei Spielen ist der Treffpunkt eine Uhrzeit und liegt automatisch 1 Stunde 15 Minuten
// vor Spielbeginn. Bei Trainings bleibt er ein freies Textfeld.
const MEETING_OFFSET_MINUTES = 75;

const meetingTimeFor = (time: string) => {
  const t = parse(time, "HH:mm", new Date());
  return isValid(t) ? format(subMinutes(t, MEETING_OFFSET_MINUTES), "HH:mm") : "";
};

// Dialog zum Erstellen und Bearbeiten von Ereignissen. Beim Bearbeiten ist der Typ fest
// und die wöchentliche Wiederholung entfällt. Events (Vereinsfeiern) haben keinen Treffpunkt,
// dafür eine Obergrenze, wie viele Gäste jeder Spieler mitbringen darf, und optional Essen.
export function EventFormDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EventType>("training");
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [homeAway, setHomeAway] = useState<"home" | "away">("home");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(DEFAULT_TIME);
  const [location, setLocation] = useState("");
  const [meeting, setMeeting] = useState("");
  const [desc, setDesc] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [maxGuests, setMaxGuests] = useState(DEFAULT_MAX_GUESTS);
  const [withFood, setWithFood] = useState(false);

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
      setMaxGuests(e.event_type === "event" ? e.max_guests : DEFAULT_MAX_GUESTS);
      setWithFood(e.event_type === "event" && e.with_food);
    }
    setOpen(next);
  };

  // Bei Heimspielen den Heimplatz als Ort eintragen. Beim Wechsel weg davon nur den
  // automatisch gesetzten Ort wieder leeren, damit eigene Eingaben erhalten bleiben.
  const applyHomeLocation = (isHomeGame: boolean) =>
    setLocation((cur) => (isHomeGame ? HOME_LOCATION : cur === HOME_LOCATION ? "" : cur));

  const selectType = (t: EventType) => {
    setType(t);
    applyHomeLocation(t === "game" && homeAway === "home");
    setMeeting(t === "game" ? meetingTimeFor(time) : "");
  };

  const selectHomeAway = (v: "home" | "away") => {
    setHomeAway(v);
    applyHomeLocation(type === "game" && v === "home");
  };

  const changeTime = (t: string) => {
    setTime(t);
    if (type === "game") setMeeting(meetingTimeFor(t));
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
          meetingPoint: type !== "event" && meeting ? meeting : null,
          eventAt: d.toISOString(),
          description: desc || null,
          groupId: Number(groupId),
          maxGuests: type === "event" ? Math.max(0, Math.min(20, maxGuests)) : null,
          withFood: type === "event" ? withFood : null,
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
        setTitle(""); setOpponent(""); setDate(""); setDesc("");
        setMeeting(type === "game" ? meetingTimeFor(time) : "");
        setLocation(type === "game" && homeAway === "home" ? HOME_LOCATION : "");
        setRecurring(false); setWeeks(4); setMaxGuests(DEFAULT_MAX_GUESTS); setWithFood(false);
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
      {/* Auf dem Handy mit Rand und scrollbar – das Formular ist länger als der Bildschirm. */}
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] rounded-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Ereignis bearbeiten" : "Neues Ereignis"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {(["training", "game", "event"] as const).map((t) => (
              <button type="button" key={t} onClick={() => selectType(t)} disabled={isEdit}
                title={isEdit ? "Der Typ kann nachträglich nicht geändert werden" : undefined}
                className={`h-10 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed ${type === t ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"}`}>
                {EVENT_TYPE_META[t].label}
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
          ) : type === "event" ? (
            <div className="space-y-2">
              <Label>Name des Events</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sommerfest" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Gegner</Label>
                <Input required value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="SV Musterhausen" />
              </div>
              <div className="space-y-2">
                <Label>Heim / Auswärts</Label>
                <Select value={homeAway} onValueChange={(v) => selectHomeAway(v as "home" | "away")}>
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
              <Input type="time" required value={time} onChange={(e) => changeTime(e.target.value)} />
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
          {type === "event" ? (
            <>
              {/* items-end: das lange Label bricht auf dem Handy um, die Felder bleiben trotzdem auf einer Höhe. */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-2">
                  <Label>Ort</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Vereinsheim" />
                </div>
                <div className="space-y-2">
                  <Label>Max. Gäste pro Spieler</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={maxGuests}
                    onChange={(e) => setMaxGuests(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Essen</Label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
                  {([false, true] as const).map((v) => (
                    <button type="button" key={String(v)} onClick={() => setWithFood(v)}
                      className={`h-10 rounded-lg text-sm font-semibold transition ${withFood === v ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}>
                      {v ? "Mit Essen" : "Ohne Essen"}
                    </button>
                  ))}
                </div>
                {withFood && (
                  <p className="text-xs text-muted-foreground">
                    Spieler wählen bei der Zusage Vegan, Vegetarisch oder Fleisch – für sich und jeden Gast.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ort</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sportplatz" />
              </div>
              <div className="space-y-2">
                <Label>Treffpunkt</Label>
                <Input type={type === "game" ? "time" : "text"} value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="Vereinsheim" />
              </div>
            </div>
          )}
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
