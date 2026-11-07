import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

// Lauf absagen – mit Pflicht-Begründung, die der Trainer sieht.
const schema = z.object({
  code: z.string().trim().min(4).max(32),
  unitId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

export const Route = createFileRoute("/api/player/preparation-decline")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/player/preparation/decline", { method: "POST", body: data });
          return jsonResponse(resp);
        }),
    },
  },
});
