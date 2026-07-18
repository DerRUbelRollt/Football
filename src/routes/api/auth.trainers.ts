import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders } from "@/lib/api-helpers.server";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(8),
  currentPassword: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/trainers")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (
            await import("@/lib/backend-client.server.ts")
          ).callBackend("/auth/trainers", {
            method: "POST",
            body: data,
            headers: forwardAuthHeaders(request),
          });
          return jsonResponse(resp);
        }),
    },
  },
});
