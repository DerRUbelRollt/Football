// "x zu prüfen": erledigte Läufe, die der Trainer noch nicht bestätigt oder abgelehnt hat.
export function ReviewBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning whitespace-nowrap">
      {count} zu prüfen
    </span>
  );
}
