import { createFileRoute } from "@tanstack/react-router";
import { forwardAuthHeaders, handle, jsonResponse } from "@/lib/api-helpers.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const { callBackendRaw } = await import("@/lib/backend-client.server.ts");
          const res = await callBackendRaw("/auth/logout", {
            method: "POST",
            headers: forwardAuthHeaders(request),
          });
          // Immer das (abgelaufene) Set-Cookie weiterreichen, damit der Browser
          // die Session sicher verwirft.
          return jsonResponse(res.data, res.status, res.setCookies);
        }),
    },
  },
});
