import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({ code: z.string().trim().min(4).max(32) });

export const Route = createFileRoute("/api/player/login")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: player, error } = await supabaseAdmin
            .from("players")
            .select("id, first_name, last_name, player_code, group_id, groups(name)")
            .eq("player_code", data.code.toUpperCase())
            .maybeSingle();
          if (error) throw new HttpError(error.message, 500);
          if (!player) throw new HttpError("Ungültige Spieler-ID", 404);
          return jsonResponse({ player });
        }),
    },
  },
});
