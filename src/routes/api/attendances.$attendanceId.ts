import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

const patchSchema = z.object({
  status: z.enum(["accepted", "declined", "pending"]),
});

export const Route = createFileRoute("/api/attendances/$attendanceId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.attendanceId, "attendanceId");
          const data = await readJson(request, patchSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/attendances/${id}`, { method: "PATCH", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
