import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Trophy,
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LegalFooter } from "@/components/legal-footer";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/groups", label: "Mannschaften", icon: Users },
  { to: "/events", label: "Ereignisse", icon: CalendarDays },
  { to: "/statistics", label: "Statistik", icon: BarChart3 },
] as const;

export function TrainerShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function signOut() {
    try {
      await api.auth.logout();
    } catch {
      // Session serverseitig ggf. schon weg — lokal trotzdem abmelden.
    }
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-pitch">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 sm:px-6 h-16">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-primary/15 grid place-items-center ring-1 ring-primary/30">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <span className="font-black tracking-tight hidden sm:inline">Team Manager</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4 mr-1" /> Abmelden
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border px-4 py-3 space-y-1 bg-background/95">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary"
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary"
            >
              <Settings className="h-4 w-4" /> Einstellungen
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary w-full"
            >
              <LogOut className="h-4 w-4" /> Abmelden
            </button>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
      <LegalFooter />
    </div>
  );
}
