import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders } from "@/lib/api-helpers.server";

const pace = z.number().int().min(180).max(720);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Vorbereitung mit allen Wochen; Beginn/Ende jeder Woche rechnet das Frontend in Ortszeit aus.
const createSchema = z.object({
  title: z.string().trim().min(1).max(60),
  groupId: z.coerce.number().int().positive(),
  startDate: day,
  endDate: day,
  runsPerWeek: z.number().int().min(1).max(4),
  rules: z.array(z.string().trim().max(200)).max(10),
  weeks: z.array(z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    distancesKm: z.array(z.number().min(0.5).max(50)).min(1).max(4),
    paceASec: pace,
    paceBSec: pace,
    paceCSec: pace,
  })).min(1).max(12),
});

export const Route = createFileRoute("/api/preparations/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handle(async () => {
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/preparations", { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, createSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend("/preparations", { method: "POST", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
