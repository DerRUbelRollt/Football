export interface PenaltyCatalogItem {
  label: string;
  amount: number;
}

export interface PenaltyCatalogGroup {
  title: string;
  items: PenaltyCatalogItem[];
}

// Aus dem Strafenkatalog SVHrH 2026-2027. Strafen, die als Kiste (Bier) verhängt werden,
// sind bewusst ausgeschlossen, da sie keinen Euro-Betrag haben.
export const PENALTY_CATALOG: PenaltyCatalogGroup[] = [
  {
    title: "Allgemein",
    items: [
      { label: "Meckern mit Mitspielern (Trainer entscheidet)", amount: 10 },
      { label: "Gelb-Rote Karte (wegen Meckern)", amount: 15 },
      { label: "Gelbe Karte (wegen Meckern)", amount: 10 },
      { label: "Rote Karte wegen Tätlichkeit (alles außer Foul- und Handspiel)", amount: 30 },
      { label: "Diskutieren mit dem Trainer (Trainer entscheidet)", amount: 10 },
      { label: "Unentschuldigtes Fehlen beim Spiel", amount: 50 },
      { label: "Unentschuldigtes Fehlen beim Training", amount: 10 },
      { label: "Zu spät zum Training/Spiel (pro Minute, Abmeldung muss 1h vorher erfolgen, max. 10 €)", amount: 1 },
      { label: "Trainingsanzug, Warmmachshirt vergessen", amount: 5 },
    ],
  },
  {
    title: "Eck-Strafen",
    items: [
      { label: "Diskutieren im Eck (beide rein)", amount: 1 },
      { label: "Beinschuss im Eck", amount: 1 },
      { label: "Doppelrunde im Eck (20 Kontakte)", amount: 1 },
    ],
  },
];
