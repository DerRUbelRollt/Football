import { useEffect, useState } from "react";
import { getSessionTokens } from "@/lib/session";
import { api, ApiError } from "@/lib/api-client";

export function useTrainerSession() {
  const [session, setSession] = useState<{ access_token: string; refresh_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const tokens = getSessionTokens();
      if (!tokens?.access_token) {
        setSession(null);
        setLoading(false);
        return;
      }

      try {
        await api.auth.verify(tokens.access_token);
        setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setSession(null);
        } else {
          setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
        }
      } finally {
        setLoading(false);
      }
    }

    void checkSession();
  }, []);

  return { session, loading };
}
