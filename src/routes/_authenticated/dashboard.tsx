import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { motion } from "framer-motion";
import { Users, CalendarDays, Trophy, Activity, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard – Trainer" }] }),
  component: Dashboard,
});

function Dashboard() {
  const q = useQuery({
    queryKey: ["trainer-dashboard"],
    queryFn: () => api.stats.dashboard(),
  });

  const stats = [
    { label: "Mannschaften", value: q.data?.groups ?? 0, icon: Users, color: "text-chart-2" },
    { label: "Spieler", value: q.data?.players ?? 0, icon: Trophy, color: "text-primary" },
    { label: "Kommende Ereignisse", value: q.data?.upcoming.length ?? 0, icon: CalendarDays, color: "text-chart-3" },
    { label: "Anwesenheit", value: `${q.data?.rate ?? 0}%`, icon: Activity, color: "text-chart-5" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Alles Wichtige auf einen Blick.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/groups"><Plus className="h-4 w-4 mr-1" /> Mannschaft</Link></Button>
          <Button asChild className="shadow-glow"><Link to="/events"><Plus className="h-4 w-4 mr-1" /> Ereignis</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-elevated p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="mt-3 text-3xl font-black">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-elevated p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Kommende Ereignisse</h2>
            <Link to="/events" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Alle anzeigen <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {q.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Lädt…</div>
          ) : q.data?.upcoming.length === 0 ? (
            <EmptyState title="Noch keine Ereignisse" hint="Erstelle dein erstes Training oder Spiel." />
          ) : (
            <ul className="space-y-2">
              {q.data?.upcoming.map((e: any) => (
                <li key={e.id}>
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: String(e.id) }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition"
                  >
                    <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${e.event_type === "training" ? "bg-primary/15 text-primary" : "bg-chart-2/15 text-chart-2"}`}>
                      {e.event_type === "training" ? <Activity className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{e.title}{e.opponent ? `` : ""}</div>
                      <div className="text-xs text-muted-foreground">{e.groups?.name} · {format(new Date(e.event_at), "EEE d. MMM · HH:mm", { locale: de })}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card-elevated p-6">
          <h2 className="text-lg font-bold mb-4">Schnellzugriff</h2>
          <div className="grid gap-2">
            <QuickLink to="/groups" label="Mannschaften verwalten" icon={Users} />
            <QuickLink to="/events" label="Ereignis anlegen" icon={CalendarDays} />
            <QuickLink to="/statistics" label="Statistiken ansehen" icon={Activity} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, label, icon: Icon }: { to: any; label: string; icon: any }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-accent transition group">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium flex-1">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition" />
    </Link>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-3">
        <Trophy className="h-6 w-6 text-primary" />
      </div>
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
