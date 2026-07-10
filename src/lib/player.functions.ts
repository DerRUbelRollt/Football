import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.object({ code: z.string().trim().min(4).max(32) });

export const loginPlayer = createServerFn({ method: "POST" })
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data }) => {
    // TODO: Call backend API instead of Supabase
    throw new Error("Not implemented - use backend API");
  });

export const getPlayerOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data }) => {
    // TODO: Call backend API instead of Supabase
    throw new Error("Not implemented - use backend API");
  });

const setSchema = z.object({
  code: z.string().trim().min(4).max(32),
  eventId: z.string().uuid(),
  status: z.enum(["accepted", "declined", "pending"]),
});

export const setPlayerAttendance = createServerFn({ method: "POST" })
  .inputValidator((d) => setSchema.parse(d))
  .handler(async ({ data }) => {
    // TODO: Call backend API instead of Supabase
    throw new Error("Not implemented - use backend API");
  });
