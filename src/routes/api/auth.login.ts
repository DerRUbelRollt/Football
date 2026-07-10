import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson, HttpError } from "@/lib/api-helpers.server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const data = await readJson(request, schema);
          const resp = await (await import("@/lib/backend-client.server")).callBackend("/auth/login", { method: "POST", body: data });
          return jsonResponse(resp);
        }),
    },
  },
});
