import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export const Route = createFileRoute("/api/groups/$groupId/players")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.groupId, "groupId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/groups/${id}/players`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      POST: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.groupId, "groupId");
          const data = await readJson(request, createSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/groups/${id}/players`, { method: "POST", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
