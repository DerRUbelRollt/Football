import { Beef, Carrot, Leaf, type LucideIcon } from "lucide-react";
import type { Meal } from "@/lib/api-client";

// Essensauswahl bei Events mit Essen – Reihenfolge und Darstellung überall gleich.
export const MEAL_ORDER: Meal[] = ["vegan", "vegetarian", "meat"];

export const MEAL_META: Record<Meal, { label: string; icon: LucideIcon }> = {
  vegan: { label: "Vegan", icon: Leaf },
  vegetarian: { label: "Vegetarisch", icon: Carrot },
  meat: { label: "Fleisch", icon: Beef },
};
