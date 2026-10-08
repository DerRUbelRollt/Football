import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventFormDialog } from "@/components/event-form-dialog";
import { Activity, Trophy, ArrowRight, Search } from "lucide-react";
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
        <EventFormDialog mode="create" onSaved={() => qc.invalidateQueries({ queryKey: ["events"] })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")}>
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
                  {e.groups?.name} · {format(new Date(e.event_at), "EEE d. MMM yyyy · HH:mm", { locale: de })}
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
