import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

// Einzelgespräch: einen der Terminvorschläge festlegen oder "Keiner passt" melden.
const schema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.coerce.number().int().positive(),
  chosenAt: z.string().datetime().optional(),
  noneFits: z.boolean().optional(),
});

export const Route = createFileRoute("/api/player/meeting")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/player/meeting", { method: "POST", body: data });
          return jsonResponse(resp);
        }),
    },
  },
});
