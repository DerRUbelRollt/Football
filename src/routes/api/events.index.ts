import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders } from "@/lib/api-helpers.server";

const eventSchema = z.object({
  eventType: z.enum(["training", "game"]),
  title: z.string().trim().min(1).max(160),
  opponent: z.string().trim().max(160).nullable().optional(),
  homeAway: z.enum(["home", "away"]).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  meetingPoint: z.string().trim().max(200).nullable().optional(),
  eventAt: z.string().datetime(),
  description: z.string().trim().max(1000).nullable().optional(),
  groupId: z.coerce.number().int().positive(),
});

const createSchema = z.array(eventSchema).min(1).max(60);

export const Route = createFileRoute("/api/events/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handle(async () => {
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/events", { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, createSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/events", { method: "POST", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
