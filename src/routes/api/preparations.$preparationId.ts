import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, forwardAuthHeaders, intParam } from "@/lib/api-helpers.server";

const pace = z.number().int().min(180).max(720);

// Nur Name, Distanzen, Pace und Regeln sind änderbar – Mannschaft, Zeitraum und Läufe pro Woche nicht.
const updateSchema = z.object({
  title: z.string().trim().min(1).max(60),
  rules: z.array(z.string().trim().max(200)).max(10),
  weeks: z.array(z.object({
    distancesKm: z.array(z.number().min(0.5).max(50)).min(1).max(4),
    paceASec: pace,
    paceBSec: pace,
    paceCSec: pace,
  })).min(1).max(12),
});

export const Route = createFileRoute("/api/preparations/$preparationId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.preparationId, "preparationId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparations/${id}`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      PATCH: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.preparationId, "preparationId");
          const data = await readJson(request, updateSchema);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparations/${id}`, { method: "PATCH", body: data, headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
      DELETE: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.preparationId, "preparationId");
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparations/${id}`, { method: "DELETE", headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
