## Kontext

Die gewünschte Funktion existiert bereits: `src/routes/_authenticated/groups.$groupId.tsx` zeigt die Mannschaftsansicht mit Spielerliste, „Neuer Spieler"-Dialog und automatisch generierter 8-stelliger `player_code`-ID, die für den Spieler-Login (`/player`) verwendet wird.

Das eigentliche Problem: Beim Klick auf eine Mannschaftskarte lädt die Route nicht – Runtime-Error:
`TypeError: error loading dynamically imported module … @tanstack/react-router/dist/esm/CatchBoundary.js`

Das ist ein Vite-Cache/Preload-Problem der dynamisch aufgeteilten Route – deshalb wirkt es, als gäbe es keine Detailansicht.

## Plan

1. **Route-Ladeproblem beheben** in `src/routes/_authenticated/groups.$groupId.tsx`
   - Ursache eingrenzen: fehlender/instabiler Chunk für `CatchBoundary`. Sicherstellen, dass `errorComponent` und `notFoundComponent` statisch definiert sind (verhindert, dass der Code-Splitter einen zusätzlichen dynamischen Chunk erzeugt, der 404 wirft).
   - Dev-Server einmal neu starten, damit der Vite-Optimize-Cache neu gebaut wird.

2. **Navigation verifizieren**
   - Karte `Röchlinge Höhe` → Route `/groups/:groupId` lädt Detailansicht.
   - „+ Spieler"-Dialog: Vor- und Nachname → Anlage funktioniert, ID (8 Zeichen, A–Z/2–9) wird generiert und angezeigt, kopierbar.
   - Spieler erscheint in Liste; Login unter `/player` mit dieser ID funktioniert.

3. **Kleine UX-Politur (nur falls schnell)**
   - Nach Anlage die neue ID im Toast klar hervorheben (bereits vorhanden – nur prüfen).

## Keine Datenbank- oder Schemaänderungen nötig.
