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
{ label: "Meckern (Trainerentscheidung)", amount: 10 },
{ label: "Gelb-Rote Karte (Meckern)", amount: 15 },
{ label: "Gelbe Karte (Meckern)", amount: 10 },
{ label: "Rote Karte (Tätlichkeit)", amount: 30 },
{ label: "Diskutieren mit Trainer", amount: 10 },
{ label: "Unentschuldigt gefehlt (Spiel)", amount: 50 },
{ label: "Unentschuldigt gefehlt (Training)", amount: 10 },
{ label: "Zu spät (pro Min., max. 10 €)", amount: 1 },
{ label: "Ball über Fangnetz", amount: 1 },
{ label: "Rote Karte (frust)", amount: 30 },
{ label: "Gelb-rote Karte (Frust)", amount: 20 },

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
