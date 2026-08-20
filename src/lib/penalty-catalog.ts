export interface PenaltyCatalogItem {
  label: string;
  amount?: number;
  crates?: number;
}

export interface PenaltyCatalogGroup {
  title: string;
  items: PenaltyCatalogItem[];
}

// Aus dem Strafenkatalog SVHrH 2026-2027.
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
  {
    title: "Bier-Strafen",
    items: [
      { label: "1. Kapitän (Aktive)", crates: 1 },
      { label: "1. Spiel (Aktive)", crates: 1 },
      { label: "1. Tor (Aktive)", crates: 1 },
      { label: "Bier/Rauchen im Trikot", crates: 1 },
      { label: "Bier verschüttet", crates: 1 },
      { label: "Elfmeter verschossen", crates: 1 },
      { label: "Kiste ohne Freigabe", crates: 1 },
    ],
  },
];
