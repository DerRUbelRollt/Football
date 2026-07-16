import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, jsonResponse, readJson } from "@/lib/api-helpers.server";

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
          const { callBackendRaw, httpErrorFromBackend } =
            await import("@/lib/backend-client.server.ts");
          const res = await callBackendRaw("/auth/login", { method: "POST", body: data });
          if (!res.ok) throw httpErrorFromBackend(res);
          // Set-Cookie des Backends (tc_session) an den Browser weiterreichen.
          return jsonResponse(res.data, 200, res.setCookies);
        }),
    },
  },
});
