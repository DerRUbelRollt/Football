import type { EventType } from "@/lib/api-client";
import { EVENT_TYPE_META } from "@/lib/event-type";

// Farbiges Icon-Kästchen je Ereignistyp; Größe und Rundung kommen vom Aufrufer.
export function EventTypeIcon({ type, className, iconClassName }: { type: EventType; className: string; iconClassName: string }) {
  const { icon: Icon, tone } = EVENT_TYPE_META[type];
  return (
    <div className={`grid place-items-center shrink-0 ${tone} ${className}`}>
      <Icon className={iconClassName} />
    </div>
  );
}
