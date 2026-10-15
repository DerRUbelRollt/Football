import { useEffect, useState } from "react";

export type VisualViewportState = { height: number; offsetTop: number; keyboardOpen: boolean };

// Ab dieser Verkleinerung des sichtbaren Bereichs werten wir sie als Bildschirmtastatur
// (kleinere Änderungen kommen z. B. von der ein-/ausfahrenden Safari-Adressleiste).
const KEYBOARD_MIN_HEIGHT = 120;

function readViewport(): VisualViewportState {
  if (typeof window === "undefined") return { height: 0, offsetTop: 0, keyboardOpen: false };
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  return { height, offsetTop: vv?.offsetTop ?? 0, keyboardOpen: window.innerHeight - height > KEYBOARD_MIN_HEIGHT };
}

// Der tatsächlich sichtbare Bildschirmbereich. Auf dem iPhone legt sich die Tastatur über die
// Seite, ohne dass sich Fenstergröße oder dvh ändern – nur window.visualViewport kennt den
// Platz darüber (height) und wie weit Safari die Seite dafür verschoben hat (offsetTop).
export function useVisualViewport(): VisualViewportState {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport(readViewport());
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return viewport;
}
