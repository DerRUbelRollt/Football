import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

// Detail eines Spielers zu einem Vorbereitungs-Ereignis (inkl. Bild) für den Trainer-Dialog.
export const Route = createFileRoute("/api/preparation-units/$unitId/players/$playerId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.unitId, "unitId");
          const playerId = intParam(params.playerId, "playerId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparation-units/${id}/players/${playerId}`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
