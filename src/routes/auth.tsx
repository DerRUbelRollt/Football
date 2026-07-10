import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { api, ApiError } from "@/lib/api-client";
import { setPlayerCode } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trophy, User, ShieldCheck, KeyRound } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – Fußball Team Manager" },
      { name: "description", content: "Melde dich als Trainer oder Spieler an." },
    ],
  }),
  component: AuthPage,
});

type Mode = "trainer" | "player";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("trainer");
  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Fußball <span className="text-gradient-primary">Team Manager</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Verwalte deine Mannschaft. Ganz einfach.
          </p>
        </div>

        <div className="card-elevated p-6 sm:p-8">
          <RoleToggle mode={mode} onChange={setMode} />
          <div className="mt-6">
            {mode === "trainer" ? <TrainerForm /> : <PlayerForm />}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Deine Daten sind sicher verschlüsselt gespeichert.
        </p>
      </motion.div>
    </div>
  );
}

function RoleToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="relative grid grid-cols-2 rounded-xl bg-secondary p-1 h-12">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-primary shadow-glow"
        style={{ left: mode === "trainer" ? 4 : "calc(50% + 0px)" }}
      />
      {(["trainer", "player"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`relative z-10 inline-flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
            mode === m ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m === "trainer" ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
          {m === "trainer" ? "Trainer" : "Spieler"}
        </button>
      ))}
    </div>
  );
}

function TrainerForm() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = isSignup
        ? await api.auth.signup({ email, password, displayName: displayName || undefined })
        : await api.auth.login({ email, password });
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      toast.success(isSignup ? "Konto erstellt. Willkommen!" : "Willkommen zurück!");
      nav({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form
      key={isSignup ? "signup" : "login"}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={onSubmit}
      className="space-y-4"
    >
      {isSignup && (
        <div className="space-y-2">
          <Label htmlFor="name">Anzeigename</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Trainer Müller" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainer@verein.de" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw">Passwort</Label>
        <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold shadow-glow">
        {loading ? "Bitte warten…" : isSignup ? "Konto erstellen" : "Anmelden"}
      </Button>
      <button
        type="button"
        onClick={() => setIsSignup((v) => !v)}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition"
      >
        {isSignup ? "Bereits registriert? Anmelden" : "Noch kein Konto? Jetzt erstellen"}
      </button>
    </motion.form>
  );
}

function PlayerForm() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { player } = await api.player.login({ code });
      setPlayerCode(player.player_code);
      toast.success(`Hallo ${player.first_name}!`);
      nav({ to: "/player" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={onSubmit}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="pcode" className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5" /> Spieler-ID
        </Label>
        <Input
          id="pcode"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="z. B. A93KD8X2"
          className="uppercase tracking-widest text-center text-lg font-mono h-14"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Deine ID hast du von deinem Trainer erhalten.
        </p>
      </div>
      <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold shadow-glow">
        {loading ? "Prüfe…" : "Anmelden"}
      </Button>
    </motion.form>
  );
}
