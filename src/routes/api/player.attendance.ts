import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.string().uuid(),
  status: z.enum(["accepted", "declined", "pending"]),
});

export const Route = createFileRoute("/api/player/attendance")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/player/attendance", { method: "POST", body: data });
          return jsonResponse(resp);
        }),
    },
  },
});
