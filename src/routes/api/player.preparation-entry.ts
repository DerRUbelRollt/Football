import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

// Eigenen eingereichten Lauf nur lesen.
const schema = z.object({
  code: z.string().trim().min(4).max(32),
  unitId: z.coerce.number().int().positive(),
});

export const Route = createFileRoute("/api/player/preparation-entry")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/player/preparation/entry", { method: "POST", body: data });
          return jsonResponse(resp);
        }),
    },
  },
});
