import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

// Wie beim Erstellen, nur ohne Ereignistyp – der ist nach dem Erstellen fest.
const updateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  opponent: z.string().trim().max(160).nullable().optional(),
  homeAway: z.enum(["home", "away"]).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  meetingPoint: z.string().trim().max(200).nullable().optional(),
  eventAt: z.string().datetime(),
  description: z.string().trim().max(1000).nullable().optional(),
  groupId: z.coerce.number().int().positive(),
});

export const Route = createFileRoute("/api/events/$eventId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.eventId, "eventId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/events/${id}`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      PATCH: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.eventId, "eventId");
          const data = await readJson(request, updateSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/events/${id}`, { method: "PATCH", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      DELETE: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.eventId, "eventId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/events/${id}`, { method: "DELETE", headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
