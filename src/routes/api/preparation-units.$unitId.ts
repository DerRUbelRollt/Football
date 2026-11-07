import { createFileRoute } from "@tanstack/react-router";
import { handle, jsonResponse, forwardAuthHeaders, intParam, HttpError } from "@/lib/api-helpers.server";

// Ein Vorbereitungs-Ereignis mit den Spielern einer Gruppe (?group=A|B|C).
export const Route = createFileRoute("/api/preparation-units/$unitId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handle(async () => {
          const id = intParam(params.unitId, "unitId");
          const group = new URL(request.url).searchParams.get("group")?.toUpperCase();
          if (group !== "A" && group !== "B" && group !== "C") throw new HttpError("Ungültige Gruppe", 400);
          const resp = await (await import("@/lib/backend-client.server.ts")).callBackend(`/preparation-units/${id}?group=${group}`, { headers: forwardAuthHeaders(request) });
          return jsonResponse(resp);
        }),
    },
  },
});
