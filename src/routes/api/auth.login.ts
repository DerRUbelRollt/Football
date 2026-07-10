import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: result, error } = await supabaseAdmin.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
          if (error || !result.session || !result.user) {
            throw new HttpError(error?.message ?? "Anmeldung fehlgeschlagen", 401);
          }
          return jsonResponse({
            session: {
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token,
              expires_at: result.session.expires_at,
              expires_in: result.session.expires_in,
              token_type: result.session.token_type,
            },
            user: { id: result.user.id, email: result.user.email ?? null },
          });
        }),
    },
  },
});
