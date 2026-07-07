import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useTrainerSession } from "@/hooks/use-trainer-session";
import { TrainerShell } from "@/components/trainer-shell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session, loading } = useTrainerSession();
  if (loading) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" />;
  return (
    <TrainerShell>
      <Outlet />
    </TrainerShell>
  );
}
