import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({ meta: [{ title: "Statistik" }] }),
  component: StatsPage,
});

function StatsPage() {
  const q = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats.attendance(),
  });

  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">Lädt…</div>;

  const items = q.data ?? [];
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-black tracking-tight">Statistik</h1>
        <div className="card-elevated"><EmptyState title="Noch keine Daten" hint="Sobald Ereignisse und Anwesenheiten erfasst sind, erscheinen hier Auswertungen." /></div>
      </div>
    );
  }

  // Per player aggregation (past events only)
  const now = Date.now();
  const past = items.filter((a: any) => a.events && new Date(a.events.event_at).getTime() < now);

  const byPlayer = new Map<number, { name: string; accepted: number; declined: number; pending: number; total: number }>();
  past.forEach((a: any) => {
    const key = a.players?.id;
    if (!key) return;
    const name = `${a.players.first_name} ${a.players.last_name[0]}.`;
    const cur = byPlayer.get(key) ?? { name, accepted: 0, declined: 0, pending: 0, total: 0 };
    cur[a.status as "accepted" | "declined" | "pending"]++;
    cur.total++;
    byPlayer.set(key, cur);
  });

  const chartData = Array.from(byPlayer.values())
    .map((p) => ({ ...p, quote: p.total ? Math.round((p.accepted / p.total) * 100) : 0 }))
    .sort((a, b) => b.quote - a.quote);

  const totals = past.reduce(
    (acc, a) => { acc[a.status as "accepted" | "declined" | "pending"]++; return acc; },
    { accepted: 0, declined: 0, pending: 0 }
  );
  const pieData = [
    { name: "Zugesagt", value: totals.accepted, color: "oklch(0.72 0.19 145)" },
    { name: "Abgesagt", value: totals.declined, color: "oklch(0.62 0.22 25)" },
    { name: "Keine Antwort", value: totals.pending, color: "oklch(0.5 0.02 250)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Statistik</h1>
        <p className="text-muted-foreground mt-1">Anwesenheit auf einen Blick.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-elevated p-6 lg:col-span-2">
          <h2 className="font-bold flex items-center gap-2 mb-4"><BarChart3 className="h-4 w-4 text-primary" /> Teilnahmequote pro Spieler</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <YAxis type="category" dataKey="name" width={100} stroke="oklch(0.5 0.02 250)" fontSize={12} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.012 250)", border: "1px solid oklch(0.28 0.012 250)", borderRadius: 8 }} formatter={(v) => `${v}%`} />
                <Bar dataKey="quote" fill="oklch(0.72 0.19 145)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-elevated p-6">
          <h2 className="font-bold mb-4">Verteilung gesamt</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.21 0.012 250)", border: "1px solid oklch(0.28 0.012 250)", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-elevated p-6">
        <h2 className="font-bold mb-4">Spieler-Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Spieler</th>
                <th className="py-2 px-3">Trainings/Spiele</th>
                <th className="py-2 px-3">Teilgenommen</th>
                <th className="py-2 px-3">Abgesagt</th>
                <th className="py-2 px-3">Offen</th>
                <th className="py-2 px-3">Quote</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((p) => (
                <tr key={p.name} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{p.name}</td>
                  <td className="py-2 px-3">{p.total}</td>
                  <td className="py-2 px-3 text-primary">{p.accepted}</td>
                  <td className="py-2 px-3 text-destructive">{p.declined}</td>
                  <td className="py-2 px-3 text-muted-foreground">{p.pending}</td>
                  <td className="py-2 px-3 font-bold">{p.quote}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
