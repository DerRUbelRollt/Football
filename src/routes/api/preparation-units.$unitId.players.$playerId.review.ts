import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

// "Bestätigt" oder "Nicht bestätigt" (dann mit Pflicht-Kommentar für den Spieler).
const schema = z.object({
  decision: z.enum(["confirm", "reject"]),
  comment: z.string().trim().max(500).nullable().optional(),
});

export const Route = createFileRoute("/api/preparation-units/$unitId/players/$playerId/review")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.unitId, "unitId");
          const playerId = intParam(params.playerId, "playerId");
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparation-units/${id}/players/${playerId}/review`, { method: "POST", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
