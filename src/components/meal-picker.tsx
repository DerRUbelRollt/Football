import type { Meal } from "@/lib/api-client";
import { MEAL_META, MEAL_ORDER } from "@/lib/meal";

// Drei große Tipp-Buttons (Vegan / Vegetarisch / Fleisch), Icon über dem Text,
// damit sie auch auf schmalen Handys nebeneinander passen.
export function MealPicker({ value, onChange }: { value: Meal | null; onChange: (meal: Meal) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MEAL_ORDER.map((m) => {
        const { label, icon: Icon } = MEAL_META[m];
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m)}
            className={`h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Kleines Badge für Listen und Chips.
export function MealBadge({ meal }: { meal: Meal }) {
  const { label, icon: Icon } = MEAL_META[meal];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}
