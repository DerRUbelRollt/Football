import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

export const Route = createFileRoute("/api/players/$playerId/groups/$groupId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) =>
        handle(async () => {
          const playerId = intParam(params.playerId, "playerId");
          const groupId = intParam(params.groupId, "groupId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/players/${playerId}/groups/${groupId}`, { method: "DELETE", headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
