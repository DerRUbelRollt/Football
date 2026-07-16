import { createFileRoute } from "@tanstack/react-router";
import { forwardAuthHeaders, handle, jsonResponse } from "@/lib/api-helpers.server";

export const Route = createFileRoute("/api/auth/verify")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handle(async () => {
          const { callBackendRaw } = await import("@/lib/backend-client.server.ts");
          const res = await callBackendRaw("/auth/verify", {
            method: "POST",
            headers: forwardAuthHeaders(request),
          });
          // Status und Cookies durchreichen: 200 → gleitend verlängertes Cookie,
          // 401 → Löschung eines ungültigen Cookies.
          return jsonResponse(res.data, res.status, res.setCookies);
        }),
    },
  },
});
