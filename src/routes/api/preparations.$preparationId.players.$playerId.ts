import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

const schema = z.object({ group: z.enum(["A", "B", "C"]) });

// Gruppe (Laufintensität) eines Spielers für die ganze Vorbereitung setzen.
export const Route = createFileRoute("/api/preparations/$preparationId/players/$playerId")({
  server: {
    handlers: {
      PUT: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.preparationId, "preparationId");
          const playerId = intParam(params.playerId, "playerId");
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparations/${id}/players/${playerId}/group`, { method: "PUT", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
