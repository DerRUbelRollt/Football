import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({ meta: [{ title: "Ereignisse" }] }),
  component: () => <Outlet />,
});
