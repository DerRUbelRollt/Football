import type { EventType, MeetingStatus } from "@/lib/api-client";
import { EVENT_TYPE_META } from "@/lib/event-type";
import { MEETING_STATUS_META } from "@/lib/meeting";

// Farbiges Icon-Kästchen je Ereignistyp; Größe und Rundung kommen vom Aufrufer.
// Mit "status" zeigt ein Einzelgespräch seinen Stand (rot/orange/grün) statt der Typfarbe.
export function EventTypeIcon({ type, status, className, iconClassName }: { type: EventType; status?: MeetingStatus | null; className: string; iconClassName: string }) {
  const { icon: Icon, tone } = EVENT_TYPE_META[type];
  const statusTone = type === "meeting" && status ? MEETING_STATUS_META[status].tone : null;
  return (
    <div className={`grid place-items-center shrink-0 ${statusTone ?? tone} ${className}`}>
      <Icon className={iconClassName} />
    </div>
  );
}
