import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const meal = z.enum(["vegan", "vegetarian", "meat"]);

const schema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.coerce.number().int().positive(),
  status: z.enum(["accepted", "declined", "pending"]),
  meal: meal.nullable().optional(),
  guests: z.array(z.object({ name: z.string().trim().max(80), meal: meal.nullable().optional() })).max(20).optional(),
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
