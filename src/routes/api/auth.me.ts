import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders } from "@/lib/api-helpers.server";

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newName: z.string().trim().min(1).max(80).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((d) => d.newName || d.newPassword, { message: "Nichts zu ändern" });

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      PATCH: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (
            await import("@/lib/backend-client.server.ts")
          ).callBackend("/auth/me", {
            method: "PATCH",
            body: data,
            headers: forwardAuthHeaders(request),
          });
          return jsonResponse(resp);
        }),
    },
  },
});
