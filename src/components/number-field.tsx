import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

// Zahl wählen: Am Handy (Touch) als native Auswahl – das iPhone zeigt dafür sein Drehrad,
// Android eine Liste. Zahlenfelder haben dort keine Pfeile, und Löschen + Neutippen ergab
// Werte wie "05". Am PC (Maus) bleibt das Zahlenfeld mit Pfeilen.
export function NumberField({
  value,
  onChange,
  min,
  max,
  optionLabel = String,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  optionLabel?: (n: number) => string;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <>
      <div className="relative pointer-fine:hidden">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pl-3 pr-8 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        >
          {options.map((n) => (
            <option key={n} value={n}>{optionLabel(n)}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="hidden pointer-fine:flex"
      />
    </>
  );
}
