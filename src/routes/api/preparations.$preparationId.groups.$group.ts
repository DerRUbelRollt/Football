import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam, HttpError } from "@/lib/api-helpers.server";

// Ordner einer Gruppe: alle Vorbereitungs-Ereignisse mit den Zählern ihrer Spieler.
export const Route = createFileRoute("/api/preparations/$preparationId/groups/$group")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.preparationId, "preparationId");
          const group = params.group?.toUpperCase();
          if (group !== "A" && group !== "B" && group !== "C") throw new HttpError("Ungültige Gruppe", 400);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparations/${id}/groups/${group}`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
