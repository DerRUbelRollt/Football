import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type PlayerPenaltyRow } from "@/lib/api-client";
import { getPlayerCode } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Wallet, Search, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/player/strafen-manager")({
  head: () => ({ meta: [{ title: "Strafenmanager" }] }),
  component: StrafenManager,
});

function StrafenManager() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);

  useEffect(() => {
    const c = getPlayerCode();
    if (!c) nav({ to: "/auth" });
    else setCode(c);
  }, [nav]);

  const overviewQ = useQuery({
    queryKey: ["player-overview", code],
    queryFn: () => api.player.overview({ code: code! }),
    enabled: !!code,
  });

  const isManager = overviewQ.data?.player.penalty_manager === true;

  useEffect(() => {
    if (overviewQ.data && !isManager) nav({ to: "/player" });
  }, [overviewQ.data, isManager, nav]);

  const penaltiesQ = useQuery({
    queryKey: ["all-penalties", code],
    queryFn: () => api.player.allPenalties({ managerCode: code! }),
    enabled: !!code && isManager,
  });

  const m = useMutation({
    mutationFn: (vars: { targetCode: string; amount: number }) =>
      api.player.penalty({ managerCode: code!, code: vars.targetCode, amount: vars.amount }),
    onSuccess: () => {
      toast.success("Strafe aktualisiert");
      qc.invalidateQueries({ queryKey: ["all-penalties", code] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : (e as Error).message),
  });

  if (!code || overviewQ.isLoading || !isManager) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const rows = (penaltiesQ.data ?? [])
    .filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !onlyOutstanding || p.player_penalty > 0)
    .sort((a, b) => b.player_penalty - a.player_penalty || a.last_name.localeCompare(b.last_name));

  const totalOutstanding = (penaltiesQ.data ?? []).reduce((sum, p) => sum + p.player_penalty, 0);

  return (
    <div className="min-h-screen bg-pitch">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-4 h-16">
          <Link to="/player" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="font-bold text-sm">Strafenmanager</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Strafen verwalten</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gesamt offen: <span className="font-semibold text-foreground">{totalOutstanding.toFixed(2)} €</span>
          </p>
        </div>

        <div className="card-elevated p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">{rows.length} von {penaltiesQ.data?.length ?? 0} Spielern</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={onlyOutstanding} onCheckedChange={setOnlyOutstanding} />
                Nur offene Strafen
              </label>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spieler suchen…" className="pl-9" />
              </div>
            </div>
          </div>

          {penaltiesQ.isLoading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Lädt…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Keine Spieler gefunden.</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((p) => (
                <PenaltyRow key={p.id} player={p} onApply={(amount) => m.mutate({ targetCode: p.player_code, amount })} pending={m.isPending} />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function PenaltyRow({
  player,
  onApply,
  pending,
}: {
  player: PlayerPenaltyRow;
  onApply: (amount: number) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("5");
  const parsed = Number(amount.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-sm font-bold shrink-0">
        {player.first_name[0]}
        {player.last_name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">
          {player.first_name} {player.last_name}
        </div>
        <div className={`text-xs font-mono ${player.player_penalty > 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {player.player_penalty.toFixed(2)} €
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          step="0.5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-20"
        />
        <Button size="sm" variant="outline" disabled={pending || !valid} onClick={() => onApply(parsed)} title="Strafe hinzufügen">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !valid || player.player_penalty <= 0}
          onClick={() => onApply(-parsed)}
          title="Strafe abziehen"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
