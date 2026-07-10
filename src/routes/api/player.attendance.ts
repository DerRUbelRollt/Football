import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.string().uuid(),
  status: z.enum(["accepted", "declined", "pending"]),
});

export const Route = createFileRoute("/api/player/attendance")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: player } = await supabaseAdmin
            .from("players")
            .select("id")
            .eq("player_code", data.code.toUpperCase())
            .maybeSingle();
          if (!player) throw new HttpError("Ungültige Spieler-ID", 404);

          const { data: ev } = await supabaseAdmin
            .from("events")
            .select("trainer_id")
            .eq("id", data.eventId)
            .maybeSingle();
          if (!ev) throw new HttpError("Ereignis nicht gefunden", 404);

          const { error } = await supabaseAdmin.from("attendances").upsert(
            {
              event_id: data.eventId,
              player_id: player.id,
              trainer_id: ev.trainer_id,
              status: data.status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "event_id,player_id" },
          );
          if (error) throw new HttpError(error.message, 500);
          return jsonResponse({ ok: true });
        }),
    },
  },
});
