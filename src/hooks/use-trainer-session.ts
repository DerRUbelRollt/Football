import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export interface TrainerSession {
  userId: number;
  email: string | null;
}

export function useTrainerSession() {
  const [session, setSession] = useState<TrainerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Aufräumen: Tokens aus der alten localStorage-basierten Auth entfernen.
    try {
      window.localStorage.removeItem("auth_tokens");
    } catch {
      // localStorage nicht verfügbar — ignorieren
    }

    // Die Session steckt im HttpOnly-Cookie; nur das Backend kann sie prüfen.
    api.auth
      .verify()
      .then((me) => {
        if (!cancelled) setSession(me);
      })
      .catch(() => {
        // 401 wie auch Netzwerkfehler bedeuten: nicht angemeldet (fail closed).
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}
