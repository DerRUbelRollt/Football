import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders } from "@/lib/api-helpers.server";

export const Route = createFileRoute("/api/players")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handle(async () => {
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/players", { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
