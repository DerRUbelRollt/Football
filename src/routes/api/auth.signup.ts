import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: result, error } = await supabaseAdmin.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              data: { display_name: data.displayName || data.email.split("@")[0] },
            },
          });
          if (error || !result.user) {
            throw new HttpError(error?.message ?? "Registrierung fehlgeschlagen", 400);
          }
          if (!result.session) {
            throw new HttpError(
              "Konto erstellt. Bitte E-Mail bestätigen und danach anmelden.",
              202,
            );
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
