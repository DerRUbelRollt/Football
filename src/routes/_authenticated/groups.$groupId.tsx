import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, ArrowLeft, Copy, Trash2, KeyRound, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { generatePlayerCode } from "@/lib/generate-player-code";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({ meta: [{ title: "Mannschaft" }] }),
  component: GroupDetail,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 text-sm text-muted-foreground">
      Fehler beim Laden: {(error as Error)?.message}
      <button className="ml-2 underline" onClick={reset}>Erneut versuchen</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Mannschaft nicht gefunden.</div>,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const groupQ = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const playersQ = useQuery({
    queryKey: ["players", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").eq("group_id", groupId).order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mannschaft gelöscht"); nav({ to: "/groups" }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deletePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Spieler gelöscht"); qc.invalidateQueries({ queryKey: ["players", groupId] }); },
  });

  const filtered = (playersQ.data ?? []).filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <Link to="/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{groupQ.data?.name ?? "…"}</h1>
          {groupQ.data?.description && <p className="text-muted-foreground mt-1">{groupQ.data.description}</p>}
        </div>
        <div className="flex gap-2">
          <AddPlayerDialog groupId={groupId} onCreated={() => qc.invalidateQueries({ queryKey: ["players", groupId] })} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mannschaft löschen?</AlertDialogTitle>
                <AlertDialogDescription>Alle zugehörigen Spieler und Ereignisse werden ebenfalls gelöscht.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteGroup.mutate()}>Löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="card-elevated p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" /> Spieler ({playersQ.data?.length ?? 0})</div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Spieler suchen…" className="pl-9" />
          </div>
        </div>

        {playersQ.isLoading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Lädt…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Noch keine Spieler" hint="Lege deinen ersten Spieler an – die eindeutige ID wird automatisch generiert." />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-sm font-bold shrink-0">
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <KeyRound className="h-3 w-3" /> {p.player_code}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(p.player_code); toast.success("ID kopiert"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Spieler löschen?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deletePlayer.mutate(p.id)}>Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddPlayerDialog({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Nicht angemeldet");
      // try up to 5 times for unique code
      for (let i = 0; i < 5; i++) {
        const code = generatePlayerCode();
        const { error } = await supabase.from("players").insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          group_id: groupId,
          trainer_id: user.user.id,
          player_code: code,
        });
        if (!error) return code;
        if (!error.message.includes("duplicate")) throw error;
      }
      throw new Error("Konnte keine eindeutige ID generieren");
    },
    onSuccess: (code) => {
      toast.success(`Spieler angelegt · ID: ${code}`);
      setFirstName(""); setLastName(""); setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-glow"><Plus className="h-4 w-4 mr-1" /> Spieler</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neuer Spieler</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vorname</Label>
              <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nachname</Label>
              <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Die Spieler-ID wird automatisch generiert.</p>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>Anlegen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
