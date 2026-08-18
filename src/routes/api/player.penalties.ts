import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

const schema = z.object({
  managerCode: z.string().trim().min(4).max(32),
});

export const Route = createFileRoute("/api/player/penalties")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);

          const resp = await (
            await import("@/lib/backend-client.server.ts")
          ).callBackend("/player/penalties", {
            method: "POST",
            body: data,
          });

          return jsonResponse(resp);
        }),
    },
  },
});
