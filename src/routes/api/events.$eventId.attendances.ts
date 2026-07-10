import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

export const Route = createFileRoute("/api/events/$eventId/attendances")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.eventId, "eventId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/events/${id}/attendances`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
