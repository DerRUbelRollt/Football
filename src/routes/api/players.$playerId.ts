import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

export const Route = createFileRoute("/api/players/$playerId")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.playerId, "playerId");
          const body = await request.json().catch(() => ({}));
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/players/${id}/groups`, { method: "POST", body, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      DELETE: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.playerId, "playerId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/players/${id}`, { method: "DELETE", headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
