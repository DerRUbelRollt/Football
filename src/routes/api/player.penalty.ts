import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

const schema = z.object({
  managerCode: z.string().trim().min(4).max(32),
  code: z.string().trim().min(4).max(32),
  amount: z.number(),
});

export const Route = createFileRoute("/api/player/penalty")({
  server: {
    handlers: {
      PATCH: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);

          const resp = await (
            await import("@/lib/backend-client.server.ts")
          ).callBackend("/player/penalty", {
            method: "PATCH",
            body: data,
          });

          return jsonResponse(resp);
        }),
    },
  },
});