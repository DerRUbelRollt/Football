import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

// Alle Teilnehmer der Vorbereitung mit ihrer Gruppe A/B/C ("Gruppen einteilen").
export const Route = createFileRoute("/api/preparations/$preparationId/players")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.preparationId, "preparationId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparations/${id}/players`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
