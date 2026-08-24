import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

const schema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.number().int(),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
});

export const Route = createFileRoute("/api/player/event-result")({
  server: {
    handlers: {
      PATCH: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (
            await import("@/lib/backend-client.server.ts")
          ).callBackend("/player/event-result", {
            method: "PATCH",
            body: data,
          });
          return jsonResponse(resp);
        }),
    },
  },
});
