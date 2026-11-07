import { Check, Clock, X } from "lucide-react";
import type { AttendanceStatus } from "@/lib/api-client";

// Die drei Status-Buttons rechts in der Teilnehmerliste (zugesagt / abgesagt / offen).
// Mit "readOnly" zeigen sie den Stand nur an und lassen sich nicht anklicken (Vorbereitungen:
// dort meldet nur der Spieler selbst). Dann sind es reine Anzeigen statt Buttons, damit sie auch
// in einer anklickbaren Zeile stehen dürfen.
export function StatusPill({ status, onChange, readOnly = false }: {
  status: AttendanceStatus | string;
  onChange?: (s: AttendanceStatus) => void;
  readOnly?: boolean;
}) {
  const cls = (active: boolean, tone: "ok" | "no" | "n") => {
    const base = "h-8 px-2.5 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition";
    if (!active) return `${base} bg-secondary text-muted-foreground ${readOnly ? "" : "hover:text-foreground"}`;
    if (tone === "ok") return `${base} bg-primary text-primary-foreground shadow-glow`;
    if (tone === "no") return `${base} bg-destructive text-destructive-foreground`;
    return `${base} bg-warning/20 text-warning`;
  };
  const items: { s: AttendanceStatus; tone: "ok" | "no" | "n"; icon: typeof Check; title: string }[] = [
    { s: "accepted", tone: "ok", icon: Check, title: "Zugesagt" },
    { s: "declined", tone: "no", icon: X, title: "Abgesagt" },
    { s: "pending", tone: "n", icon: Clock, title: "Offen" },
  ];
  return (
    <div className="flex gap-1">
      {items.map(({ s, tone, icon: Icon, title }) =>
        readOnly ? (
          <span key={s} className={cls(status === s, tone)} aria-hidden>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button key={s} type="button" className={cls(status === s, tone)} onClick={() => onChange?.(s)} title={title}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ),
      )}
    </div>
  );
}
