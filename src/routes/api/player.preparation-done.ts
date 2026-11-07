import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

// Lauf als erledigt melden: Screenshot (vom Browser verkleinert, als Data-URL) und optional ein Text.
const schema = z.object({
  code: z.string().trim().min(4).max(32),
  unitId: z.coerce.number().int().positive(),
  image: z.string().startsWith("data:image/").max(4_500_000),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const Route = createFileRoute("/api/player/preparation-done")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/player/preparation/done", { method: "POST", body: data });
          return jsonResponse(resp);
        }),
    },
  },
});
