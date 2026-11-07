import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/preparations")({
  head: () => ({ meta: [{ title: "Vorbereitung" }] }),
  component: () => <Outlet />,
});
