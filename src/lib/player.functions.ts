import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.object({ code: z.string().trim().min(4).max(32) });

export const loginPlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, first_name, last_name, player_code, group_id, groups(name)")
      .eq("player_code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!player) throw new Error("Ungültige Spieler-ID");
    return player;
  });

export const getPlayerOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, first_name, last_name, player_code, group_id, groups(name)")
      .eq("player_code", data.code.toUpperCase())
      .maybeSingle();
    if (!player) throw new Error("Ungültige Spieler-ID");

    const nowIso = new Date().toISOString();
    const { data: upcoming } = await supabaseAdmin
      .from("events")
      .select("id, event_type, title, opponent, home_away, location, meeting_point, event_at, description, attendances!inner(id, status, player_id)")
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

    return { player, upcoming: upcoming ?? [], history: history ?? [] };
  });

const setSchema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.string().uuid(),
  status: z.enum(["accepted", "declined", "pending"]),
});

export const setPlayerAttendance = createServerFn({ method: "POST" })
  .inputValidator((d) => setSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("player_code", data.code.toUpperCase())
      .maybeSingle();
    if (!player) throw new Error("Ungültige Spieler-ID");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("trainer_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev) throw new Error("Ereignis nicht gefunden");

    const { error } = await supabaseAdmin
      .from("attendances")
      .upsert(
        {
          event_id: data.eventId,
          player_id: player.id,
          trainer_id: ev.trainer_id,
          status: data.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id,player_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
