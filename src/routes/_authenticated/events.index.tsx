import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type NewEvent } from "@/lib/api-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Activity, Trophy, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({ meta: [{ title: "Ereignisse" }] }),
  component: EventsPage,
});

function EventsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const q = useQuery({
    queryKey: ["events"],
    queryFn: () => api.events.list(),
  });

  const now = new Date();
  const list = (q.data ?? []).filter((e) => {
    const isFuture = new Date(e.event_at) >= now;
    if (tab === "upcoming" && !isFuture) return false;
    if (tab === "past" && isFuture) return false;
    const s = search.toLowerCase();
    return !s || e.title.toLowerCase().includes(s) || (e.opponent ?? "").toLowerCase().includes(s);
  }).sort((a, b) => tab === "upcoming"
    ? new Date(a.event_at).getTime() - new Date(b.event_at).getTime()
    : new Date(b.event_at).getTime() - new Date(a.event_at).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Ereignisse</h1>
          <p className="text-muted-foreground mt-1">Trainings und Spiele deiner Mannschaften.</p>
        </div>
        <CreateEventDialog onCreated={() => qc.invalidateQueries({ queryKey: ["events"] })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="upcoming">Kommend</TabsTrigger>
            <TabsTrigger value="past">Vergangen</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche…" className="pl-9" />
        </div>
      </div>

      {q.isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Lädt…</div>
      ) : list.length === 0 ? (
        <div className="card-elevated"><EmptyState title="Keine Ereignisse" hint="Erstelle dein erstes Training oder Spiel." /></div>
      ) : (
        <div className="grid gap-3">
          {list.map((e) => (
            <Link key={e.id} to="/events/$eventId" params={{ eventId: String(e.id) }} className="card-elevated p-4 flex items-center gap-4 hover:border-primary/50 transition group">
              <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 ${e.event_type === "training" ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2"}`}>
                {e.event_type === "training" ? <Activity className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{e.title}{e.opponent ? `` : ""}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {(e.groups as any)?.name} · {format(new Date(e.event_at), "EEE d. MMM yyyy · HH:mm", { locale: de })}
                  {e.location ? ` · ${e.location}` : ""}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateEventDialog({ onCreated }: { onCreated: () => void }) {
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

  const m = useMutation({
    mutationFn: async () => {
      const base = new Date(`${date}T${time}`);
      const count = type === "training" && recurring ? Math.max(1, Math.min(52, weeks)) : 1;
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
      const { count: created } = await api.events.create(rows);
      return created;
    },
    onSuccess: (n) => {
      toast.success(n && n > 1 ? `${n} Trainings erstellt` : "Ereignis erstellt");
      setTitle(""); setOpponent(""); setDate(""); setLocation(""); setMeeting(""); setDesc("");
      setRecurring(false); setWeeks(4);
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-glow"><Plus className="h-4 w-4 mr-1" /> Ereignis</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Neues Ereignis</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["training", "game"] as const).map((t) => (
              <button type="button" key={t} onClick={() => setType(t)}
                className={`h-10 rounded-lg text-sm font-semibold transition ${type === t ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}>
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
                <Select value={homeAway} onValueChange={(v) => setHomeAway(v as any)}>
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
          {type === "training" && (
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
            <Button type="submit" disabled={m.isPending || !groupId}>Erstellen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
