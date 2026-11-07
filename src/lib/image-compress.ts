// Verkleinert ein ausgewähltes Foto im Browser, bevor es hochgeladen wird: längste Seite max.
// 1600 px, JPEG. Handy-Screenshots haben oft mehrere MB – so bleiben es meist 200–600 KB.
const MAX_SIDE = 1600;
const QUALITIES = [0.8, 0.7, 0.6, 0.5];
// Grenze des Backends (3 MB) mit Puffer, als Länge der Data-URL (Base64 ≈ 4/3 der Bytes).
const MAX_DATA_URL_LENGTH = 3_900_000;

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Bitte ein Bild auswählen");
  const { source, width, height, release } = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Das Bild konnte nicht verarbeitet werden");
    // Weißer Hintergrund, damit transparente PNGs als JPEG nicht schwarz werden.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const q of QUALITIES) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= MAX_DATA_URL_LENGTH) return url;
    }
    throw new Error("Das Bild ist zu groß");
  } finally {
    release();
  }
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" dreht Handyfotos anhand der EXIF-Ausrichtung richtig herum.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // Weiter mit <img> – manche Browser können bestimmte Formate nur so.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Dieses Bildformat wird nicht unterstützt – bitte ein JPG oder PNG wählen");
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}
