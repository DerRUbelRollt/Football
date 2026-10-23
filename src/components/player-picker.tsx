import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

// Auswahl genau eines Spielers aus allen Spielern, mit Suchfeld (Name oder Spieler-ID).
// "modal" am Popover, damit die Liste innerhalb des Ereignis-Dialogs scrollbar bleibt.
export function PlayerPicker({ value, onChange, disabled }: { value: number | null; onChange: (id: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const playersQ = useQuery({
    queryKey: ["all-players"],
    queryFn: () => api.players.list(),
  });
  const players = [...(playersQ.data ?? [])].sort((a, b) =>
    a.last_name.localeCompare(b.last_name, "de") || a.first_name.localeCompare(b.first_name, "de"));
  const selected = players.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className="w-full justify-between font-normal">
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
            {selected ? `${selected.first_name} ${selected.last_name}` : playersQ.isLoading ? "Lädt…" : "Spieler wählen…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Name oder ID suchen…" />
          <CommandList className="max-h-60">
            <CommandEmpty>Keine Spieler gefunden.</CommandEmpty>
            {players.map((p) => (
              <CommandItem key={p.id} value={`${p.first_name} ${p.last_name} ${p.player_code}`}
                onSelect={() => { onChange(p.id); setOpen(false); }}>
                <Check className={`h-4 w-4 ${p.id === value ? "opacity-100" : "opacity-0"}`} />
                <span className="flex-1 truncate">{p.first_name} {p.last_name}</span>
                <span className="text-xs text-muted-foreground font-mono">{p.player_code}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
