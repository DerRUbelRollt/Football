import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

const schema = z.object({
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
});

export const Route = createFileRoute("/api/events/$eventId/result")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.eventId, "eventId");
          const data = await readJson(request, schema);
          const resp = await (
            await import("@/lib/backend-client.server.ts")
          ).callBackend(`/events/${id}/result`, {
            method: "PATCH",
            body: data,
            headers: forwardAuthHeaders(request),
          });
          return jsonResponse(resp);
        }),
    },
  },
});
