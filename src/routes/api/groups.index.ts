import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders } from "@/lib/api-helpers.server";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
});

export const Route = createFileRoute("/api/groups/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handle(async () => {
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/groups", { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, createSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/groups", { method: "POST", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
