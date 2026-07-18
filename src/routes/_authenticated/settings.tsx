import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTrainerSession } from "@/hooks/use-trainer-session";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Einstellungen" }] }),
  component: SettingsPage,
});

function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : (e as Error).message;
}

function SettingsPage() {
  const { session } = useTrainerSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground mt-1">Profil verwalten und weitere Trainer anlegen.</p>
      </div>

      <ProfileCard currentName={session?.name ?? ""} />

      <div className="card-elevated p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg">Trainer-Konten</h2>
          <p className="text-sm text-muted-foreground mt-1">Lege ein weiteres Trainer-Konto an.</p>
        </div>
        <CreateTrainerDialog />
      </div>
    </div>
  );
}

function ProfileCard({ currentName }: { currentName: string }) {
  const [displayName, setDisplayName] = useState(currentName);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  // currentName kommt erst asynchron aus useTrainerSession() an — nachziehen, sobald sie da ist.
  useEffect(() => {
    if (currentName) setDisplayName(currentName);
  }, [currentName]);

  const m = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({
        currentPassword,
        newName: newName.trim() || undefined,
        newPassword: newPassword || undefined,
      }),
    onSuccess: (data) => {
      toast.success("Profil aktualisiert");
      setDisplayName(data.name);
      setNewName("");
      setNewPassword("");
      setCurrentPassword("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="card-elevated p-6 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Profil</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Angemeldet als <span className="font-medium text-foreground">{displayName}</span>
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="space-y-4 max-w-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="newName">Neuer Name (optional)</Label>
          <Input
            id="newName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={displayName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">Neues Passwort (optional)</Label>
          <Input
            id="newPassword"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
          <Input
            id="currentPassword"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" disabled={m.isPending} className="shadow-glow">
          Speichern
        </Button>
      </form>
    </div>
  );
}

function CreateTrainerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const m = useMutation({
    mutationFn: () => api.auth.createTrainer({ name: name.trim(), password, currentPassword }),
    onSuccess: () => {
      toast.success(`Trainer „${name.trim()}" angelegt`);
      setName("");
      setPassword("");
      setCurrentPassword("");
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-glow">
          <Plus className="h-4 w-4 mr-1" /> Neuer Trainer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuen Trainer anlegen</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Max Mustermann"
            />
          </div>
          <div className="space-y-2">
            <Label>Passwort</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label>Dein aktuelles Passwort (zur Bestätigung)</Label>
            <Input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={m.isPending}>
              Anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
