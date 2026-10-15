import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import type { EventGuest, Meal, PlayerUpcomingEvent } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { MealPicker } from "@/components/meal-picker";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { Check, UserPlus, Utensils, X } from "lucide-react";

type GuestRow = { id: number; name: string; meal: Meal | null };

// Zusage zu einem Event als Bottom-Sheet (die App wird fast nur am Handy genutzt):
// eigene Essenswahl und Gäste mit ihrem Essen auf einer Seite. Essen gibt es nur bei
// Events "Mit Essen", Gäste nur, wenn der Trainer welche erlaubt hat.
export function ParticipationSheet({
  event,
  open,
  saving,
  onClose,
  onSave,
}: {
  event: PlayerUpcomingEvent;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { meal: Meal | null; guests: EventGuest[] }) => void;
}) {
  const max = event.max_guests;
  const withFood = event.with_food;
  const current = event.attendances[0]?.status === "accepted" ? event.attendances[0] : undefined;

  const nextId = useRef(0);
  const [meal, setMeal] = useState<Meal | null>(withFood ? current?.meal ?? null : null);
  const [guests, setGuests] = useState<GuestRow[]>(() =>
    (current?.guests ?? []).map((g) => ({ id: nextId.current++, name: g.name, meal: withFood ? g.meal : null })),
  );
  const [focusId, setFocusId] = useState<number | null>(null);

  // Tastatur-bewusstes Sheet: Geht beim Tippen die Bildschirmtastatur auf, fährt das Sheet an die
  // Decke und füllt genau den sichtbaren Bereich darüber (Kopf oben fest, Speichern direkt über der
  // Tastatur). Es bleibt bis zum Schließen oben, damit beim Tippen auf die Essens-Buttons – die
  // Tastatur geht dabei zu – nichts springt. vaul schiebt das Sheet dafür nicht selbst hoch
  // (repositionInputs={false}); zusammen mit dem Hochschieben durch iOS landete es sonst oberhalb
  // des Bildschirms.
  const viewport = useVisualViewport();
  const formRef = useRef<HTMLFormElement>(null);
  const [typingIn, setTypingIn] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typingIn && viewport.keyboardOpen) setExpanded(true);
  }, [typingIn, viewport.keyboardOpen]);

  // Den Gast, dessen Namen man gerade tippt, samt Essens-Buttons direkt unter den Kopf scrollen.
  useEffect(() => {
    const body = formRef.current;
    if (!expanded || !typingIn || !body) return;
    const offset = typingIn.getBoundingClientRect().top - body.getBoundingClientRect().top;
    body.scrollTo({ top: body.scrollTop + offset - 8, behavior: "smooth" });
  }, [expanded, typingIn, viewport.height]);

  const onFieldFocus = (ev: FocusEvent<HTMLFormElement>) => {
    if (ev.target instanceof HTMLInputElement) setTypingIn(ev.target.closest<HTMLElement>("[data-guest-row]") ?? ev.target);
  };
  const onFieldBlur = (ev: FocusEvent<HTMLFormElement>) => {
    if (ev.target instanceof HTMLInputElement) setTypingIn(null);
  };

  const updateGuest = (id: number, patch: Partial<GuestRow>) =>
    setGuests((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const addGuest = () => {
    const id = nextId.current++;
    setGuests((gs) => [...gs, { id, name: "", meal: null }]);
    setFocusId(id);
  };

  // Gäste ohne Namen werden beim Speichern verworfen.
  const named = guests.filter((g) => g.name.trim());
  const guestWord = max === 1 ? "Gast" : "Gäste";
  const guestWithoutMeal = withFood ? named.find((g) => !g.meal) : undefined;
  const problem =
    named.length > max ? (max === 0 ? "Keine Gäste mehr erlaubt – bitte entfernen." : `Maximal ${max} ${guestWord} erlaubt.`)
    : withFood && !meal ? "Bitte wähle dein Essen."
    : guestWithoutMeal ? `Bitte wähle ein Essen für ${guestWithoutMeal.name.trim()}.`
    : null;

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (problem) return;
    onSave({
      meal: withFood ? meal : null,
      guests: named.map((g) => ({ name: g.name.trim(), meal: withFood ? g.meal : null })),
    });
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }} shouldScaleBackground={false} repositionInputs={false}>
      <DrawerContent
        className="max-h-[92dvh] sm:max-w-lg sm:mx-auto"
        style={expanded ? { top: viewport.offsetTop, bottom: "auto", height: viewport.height, maxHeight: "none", marginTop: 0 } : undefined}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>{current ? "Zusage bearbeiten" : "Deine Zusage"}</DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-x-2">
            <span>{event.title}</span>
            {withFood && <span className="inline-flex items-center gap-1 text-primary"><Utensils className="h-3.5 w-3.5" /> Mit Essen</span>}
          </DrawerDescription>
        </DrawerHeader>

        <form id="participation-form" ref={formRef} onSubmit={submit} onFocus={onFieldFocus} onBlur={onFieldBlur}
          className="flex-1 overflow-y-auto px-4 pb-2 space-y-5">
          {withFood && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Was isst du?</h3>
              <MealPicker value={meal} onChange={setMeal} />
            </section>
          )}

          {/* Auch bei Limit 0 zeigen, solange noch Gäste eingetragen sind – sonst ließen sie sich
              nach einer Senkung durch den Trainer nicht mehr entfernen. */}
          {(max > 0 || guests.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Bringst du jemanden mit?</h3>
                <span className="text-xs text-muted-foreground">{max > 0 ? `bis zu ${max} ${guestWord}` : "keine Gäste mehr erlaubt"}</span>
              </div>
              {guests.map((g, i) => (
                <div key={g.id} data-guest-row className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex gap-2">
                    {/* "Fertig" auf der Tastatur schließt nur die Tastatur, statt die Zusage abzuschicken. */}
                    <Input
                      value={g.name}
                      maxLength={80}
                      placeholder={`Name Gast ${i + 1}`}
                      autoFocus={g.id === focusId}
                      enterKeyHint="done"
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.currentTarget.blur(); } }}
                      onChange={(ev) => updateGuest(g.id, { name: ev.target.value })}
                    />
                    <Button type="button" variant="outline" size="icon" className="shrink-0" title="Gast entfernen"
                      onClick={() => setGuests((gs) => gs.filter((x) => x.id !== g.id))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {withFood && <MealPicker value={g.meal} onChange={(m) => updateGuest(g.id, { meal: m })} />}
                </div>
              ))}
              {max > 0 && (
                <Button type="button" variant="outline" className="w-full" disabled={guests.length >= max} onClick={addGuest}>
                  <UserPlus className="h-4 w-4 mr-1" /> Gast hinzufügen ({guests.length}/{max})
                </Button>
              )}
            </section>
          )}
        </form>

        <DrawerFooter>
          {problem && <p className="text-xs text-yellow-400 text-center">{problem}</p>}
          <Button type="submit" form="participation-form" className="w-full h-12 shadow-glow" disabled={saving || !!problem}>
            <Check className="h-4 w-4 mr-1" /> {current ? "Speichern" : "Zusagen"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
