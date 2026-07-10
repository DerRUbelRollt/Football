import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({ code: z.string().trim().min(4).max(32) });

export const Route = createFileRoute("/api/player/overview")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: player } = await supabaseAdmin
            .from("players")
            .select("id, first_name, last_name, player_code, group_id, groups(name)")
            .eq("player_code", data.code.toUpperCase())
            .maybeSingle();
          if (!player) throw new HttpError("Ungültige Spieler-ID", 404);

          const nowIso = new Date().toISOString();

          const { data: upcoming } = await supabaseAdmin
            .from("events")
            .select(
              "id, event_type, title, opponent, home_away, location, meeting_point, event_at, description, attendances!inner(id, status, player_id)",
            )
            .eq("group_id", player.group_id)
            .gte("event_at", nowIso)
            .eq("attendances.player_id", player.id)
            .order("event_at", { ascending: true });

          const { data: history } = await supabaseAdmin
            .from("events")
            .select("id, event_type, title, event_at, attendances!inner(status, player_id)")
            .eq("group_id", player.group_id)
            .lt("event_at", nowIso)
            .eq("attendances.player_id", player.id)
            .order("event_at", { ascending: false })
            .limit(50);

          return jsonResponse({ player, upcoming: upcoming ?? [], history: history ?? [] });
        }),
    },
  },
});
