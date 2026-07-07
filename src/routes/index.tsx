import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTrainerSession } from "@/hooks/use-trainer-session";
import { getPlayerCode } from "@/lib/player-session";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useTrainerSession();
  if (loading) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" />;
  const code = getPlayerCode();
  if (code) return <Navigate to="/player" />;
  return <Navigate to="/auth" />;
}
