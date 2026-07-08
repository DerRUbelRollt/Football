import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({ meta: [{ title: "Mannschaften" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, description, created_at, players(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (q.data ?? []).filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Mannschaften</h1>
          <p className="text-muted-foreground mt-1">Verwalte deine Teams und Spielergruppen.</p>
        </div>
        <CreateGroupDialog onCreated={() => qc.invalidateQueries({ queryKey: ["groups"] })} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mannschaft suchen…" className="pl-9" />
      </div>

      {q.isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="card-elevated"><EmptyState title="Noch keine Mannschaften" hint="Erstelle deine erste Mannschaft, um Spieler hinzuzufügen." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link to="/groups/$groupId" params={{ groupId: g.id }} className="card-elevated p-5 block hover:border-primary/50 transition group">
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
                </div>
                <h3 className="mt-4 font-bold text-lg">{g.name}</h3>
                {g.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
                <div className="mt-4 text-xs text-muted-foreground">{(g.players as any)?.[0]?.count ?? 0} Spieler</div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("groups").insert({ name, description: description || null, trainer_id: user.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mannschaft erstellt");
      setName(""); setDescription(""); setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-glow"><Plus className="h-4 w-4 mr-1" /> Neue Mannschaft</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Mannschaft</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Erste Mannschaft" />
          </div>
          <div className="space-y-2">
            <Label>Beschreibung (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kreisliga A, Saison 2026" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>Erstellen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}