import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { jsPDF } from "jspdf";
import type { EventDetail } from "@/lib/api-client";

export interface KitColors {
  shirt: string;
  shorts: string;
  socks: string;
}

export interface PdfPlayer {
  first_name: string;
  last_name: string;
}

type RGB = [number, number, number];

// Vereinsfarben aus dem Wappen (schwarz/gelb) plus neutrale Flächen.
const INK: RGB = [17, 17, 17];
const GOLD: RGB = [242, 194, 0];
const MUTED: RGB = [115, 115, 115];
const SUBTLE: RGB = [205, 205, 205];
const SURFACE: RGB = [245, 245, 241];
const BORDER: RGB = [214, 214, 208];
const WHITE: RGB = [255, 255, 255];

const PAGE_W = 210;
const MARGIN = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = 284;
const LIST_BOTTOM = FOOTER_Y - 5;
const CLUB_NAME = "SV 1949 Hermann Röchling Höhe e.V.";

// Bekannte Farbnamen für die Farbvorschau bei den Trikots. Spezifische Namen ("dunkelblau")
// haben Vorrang vor darin enthaltenen allgemeinen ("blau").
const KIT_COLOR_NAMES: [string, RGB][] = [
  ["dunkelblau", [16, 42, 110]],
  ["navy", [16, 42, 110]],
  ["hellblau", [110, 190, 245]],
  ["himmelblau", [110, 190, 245]],
  ["türkis", [26, 188, 156]],
  ["weinrot", [123, 30, 43]],
  ["bordeaux", [123, 30, 43]],
  ["dunkelgrün", [20, 90, 50]],
  ["hellgrün", [120, 200, 80]],
  ["schwarz", INK],
  ["weiß", WHITE],
  ["weiss", WHITE],
  ["gelb", GOLD],
  ["gold", [212, 175, 55]],
  ["orange", [245, 124, 0]],
  ["rot", [211, 47, 47]],
  ["blau", [30, 79, 216]],
  ["grün", [46, 158, 68]],
  ["gruen", [46, 158, 68]],
  ["grau", [138, 138, 138]],
  ["silber", [192, 192, 192]],
  ["lila", [123, 63, 181]],
  ["violett", [123, 63, 181]],
  ["pink", [236, 91, 167]],
  ["rosa", [244, 160, 190]],
  ["braun", [109, 76, 65]],
];

// Liefert bis zu zwei erkannte Farben in der Reihenfolge, in der sie genannt wurden ("Gelb-Schwarz").
function kitColors(value: string): RGB[] {
  const s = value.toLowerCase();
  const hits: { start: number; end: number; color: RGB }[] = [];
  for (const [name, color] of KIT_COLOR_NAMES) {
    const start = s.indexOf(name);
    if (start >= 0) hits.push({ start, end: start + name.length, color });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  const result: RGB[] = [];
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.start < lastEnd) continue;
    lastEnd = hit.end;
    if (!result.some((c) => c.join() === hit.color.join())) result.push(hit.color);
    if (result.length === 2) break;
  }
  return result;
}

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/HRH.jpg");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

// Schreibt einen Wert einzeilig; ist er zu lang, kleiner und auf max. zwei Zeilen umgebrochen.
function drawValue(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, size: number, smallSize: number) {
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.setFontSize(size);
  if (doc.getTextWidth(text) <= maxWidth) {
    doc.text(text, x, y);
    return;
  }
  doc.setFontSize(smallSize);
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  const shown = lines.slice(0, 2);
  if (lines.length > 2) shown[1] = fitText(doc, `${shown[1]} ${lines.slice(2).join(" ")}`, maxWidth);
  const lineH = smallSize * 0.42;
  const startY = shown.length > 1 ? y - lineH / 2 - 0.4 : y;
  shown.forEach((line, i) => doc.text(line, x, startY + i * lineH));
}

function drawLogo(doc: jsPDF, logo: string | null, x: number, y: number, size: number, padding: number) {
  doc.setFillColor(...WHITE);
  doc.roundedRect(x, y, size, size, size * 0.12, size * 0.12, "F");
  if (!logo) return;
  const props = doc.getImageProperties(logo);
  const inner = size - 2 * padding;
  const scale = Math.min(inner / props.width, inner / props.height);
  const w = props.width * scale;
  const h = props.height * scale;
  doc.addImage(logo, "JPEG", x + (size - w) / 2, y + (size - h) / 2, w, h);
}

function drawHeader(doc: jsPDF, event: EventDetail, logo: string | null) {
  const height = 56;
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, height, "F");

  // Diagonale Akzentstreifen rechts im Kopfbereich.
  doc.setFillColor(...GOLD);
  doc.lines([[20, 0], [-30, height], [-20, 0]], 172, 0, [1, 1], "F", true);
  doc.lines([[6, 0], [-30, height], [-6, 0]], 197, 0, [1, 1], "F", true);
  doc.rect(0, height, PAGE_W, 1.6, "F");

  drawLogo(doc, logo, MARGIN, 12, 32, 2.6);

  const x = MARGIN + 42;
  const maxWidth = 88;
  const isGame = event.event_type === "game";

  const label = isGame
    ? `SPIELTAG${event.home_away ? ` · ${event.home_away === "home" ? "HEIMSPIEL" : "AUSWÄRTSSPIEL"}` : ""}`
    : "TRAINING";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text(label, x, 20, { charSpace: 0.9 });

  const headline = isGame && event.opponent ? `vs. ${event.opponent}` : event.title;
  let size = 26;
  doc.setTextColor(...WHITE);
  doc.setFontSize(size);
  while (size > 17 && doc.getTextWidth(headline) > maxWidth) doc.setFontSize(--size);
  const headLines = (doc.splitTextToSize(headline, maxWidth) as string[]).slice(0, 2);
  const lineH = size * 0.4;
  let y = 20 + lineH + 2;
  headLines.forEach((line, i) => doc.text(fitText(doc, line, maxWidth), x, y + i * lineH));
  y += (headLines.length - 1) * lineH;

  const subtitle = [isGame && event.opponent ? event.title : null, event.groups?.name ?? null]
    .filter(Boolean)
    .join(" · ");
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...SUBTLE);
    doc.text(fitText(doc, subtitle, maxWidth), x, y + 7.5);
  }
}

function drawContinuationHeader(doc: jsPDF, logo: string | null) {
  const height = 22;
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, height, "F");
  doc.setFillColor(...GOLD);
  doc.lines([[10, 0], [-12, height], [-10, 0]], 186, 0, [1, 1], "F", true);
  doc.lines([[3, 0], [-12, height], [-3, 0]], 200, 0, [1, 1], "F", true);
  doc.rect(0, height, PAGE_W, 1.2, "F");

  drawLogo(doc, logo, MARGIN, 4, 14, 1.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text("Kader (Fortsetzung)", MARGIN + 20, 13.2);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, badge?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(title.toUpperCase(), MARGIN, y, { charSpace: 0.8 });
  doc.setFillColor(...GOLD);
  doc.rect(MARGIN, y + 2, 10, 1, "F");

  if (badge) {
    doc.setFontSize(8);
    const w = doc.getTextWidth(badge) + 7;
    doc.setFillColor(...GOLD);
    doc.roundedRect(PAGE_W - MARGIN - w, y - 4.6, w, 6.4, 3.2, 3.2, "F");
    doc.setTextColor(...INK);
    doc.text(badge, PAGE_W - MARGIN - w / 2, y - 0.3, { align: "center" });
  }
}

function drawInfoCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setFillColor(...SURFACE);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setFillColor(...GOLD);
  doc.rect(x, y + 3.5, 1.4, h - 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 7, y + 6.5, { charSpace: 0.6 });
  drawValue(doc, value, x + 7, y + 13.2, w - 12, 12, 9.5);
}

function drawKitCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setFillColor(...SURFACE);
  doc.roundedRect(x, y, w, h, 3, 3, "F");

  const cx = x + 10;
  const cy = y + h / 2;
  const r = 4.4;
  const colors = value ? kitColors(value) : [];
  doc.setLineWidth(0.4);
  doc.setDrawColor(...BORDER);
  if (colors.length > 0) {
    doc.setFillColor(...colors[0]);
    doc.circle(cx, cy, r, "F");
    if (colors[1]) {
      // Zweite Farbe als rechte Kreishälfte (Kreis dient als Clipping-Pfad).
      doc.saveGraphicsState();
      doc.circle(cx, cy, r, null);
      doc.clip();
      doc.discardPath();
      doc.setFillColor(...colors[1]);
      doc.rect(cx, cy - r, r, 2 * r, "F");
      doc.restoreGraphicsState();
    }
    doc.circle(cx, cy, r, "S");
  } else {
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.circle(cx, cy, r, "S");
    doc.setLineDashPattern([], 0);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 18, y + 7.5, { charSpace: 0.6 });
  drawValue(doc, value || "-", x + 18, y + 13.8, w - 22, 11, 9);
}

function drawPlayerRow(doc: jsPDF, x: number, y: number, w: number, h: number, number: number, player: PdfPlayer, zebra: boolean) {
  if (zebra) {
    doc.setFillColor(...SURFACE);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
  }
  const cy = y + h / 2;
  doc.setFillColor(...INK);
  doc.circle(x + 5.5, cy, 2.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text(String(number), x + 5.5, cy + 0.85, { align: "center" });

  const nameX = x + 11;
  const maxWidth = w - 14;
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  const firstW = doc.getTextWidth(player.first_name) + 1.4;
  doc.setFont("helvetica", "bold");
  if (firstW + doc.getTextWidth(player.last_name) <= maxWidth) {
    doc.setFont("helvetica", "normal");
    doc.text(player.first_name, nameX, cy + 1.2);
    doc.setFont("helvetica", "bold");
    doc.text(player.last_name, nameX + firstW, cy + 1.2);
  } else {
    doc.text(fitText(doc, `${player.first_name} ${player.last_name}`, maxWidth), nameX, cy + 1.2);
  }
}

function drawSquad(doc: jsPDF, players: PdfPlayer[], top: number, logo: string | null) {
  drawSectionTitle(doc, "Kader", top, `${players.length} ${players.length === 1 ? "ZUSAGE" : "ZUSAGEN"}`);
  let listTop = top + 6.5;

  if (players.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Noch keine Zusagen für dieses Ereignis.", MARGIN, listTop + 5);
    return;
  }

  const rowH = 7.2;
  const gap = 6;
  const colW = (CONTENT_W - gap) / 2;
  let index = 0;
  while (index < players.length) {
    const rowsPerCol = Math.max(1, Math.floor((LIST_BOTTOM - listTop) / rowH));
    const chunk = Math.min(players.length - index, rowsPerCol * 2);
    // Spaltenweise füllen und auf beide Spalten gleichmäßig verteilen.
    const rows = Math.ceil(chunk / 2);
    for (let i = 0; i < chunk; i++) {
      const col = i < rows ? 0 : 1;
      const row = col === 0 ? i : i - rows;
      const x = MARGIN + col * (colW + gap);
      const y = listTop + row * rowH;
      drawPlayerRow(doc, x, y, colW, rowH - 1.2, index + i + 1, players[index + i], row % 2 === 0);
    }
    index += chunk;
    if (index < players.length) {
      doc.addPage();
      drawContinuationHeader(doc, logo);
      listTop = 32;
    }
  }
}

function drawFooters(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const created = format(new Date(), "dd.MM.yyyy");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...GOLD);
    doc.rect(MARGIN, FOOTER_Y, CONTENT_W, 0.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(CLUB_NAME, MARGIN, FOOTER_Y + 5.5);
    doc.text(`Erstellt am ${created} · Seite ${i}/${pages}`, PAGE_W - MARGIN, FOOTER_Y + 5.5, { align: "right" });
  }
}

function fileName(event: EventDetail): string {
  const date = format(new Date(event.event_at), "yyyy-MM-dd");
  const base = event.event_type === "game"
    ? `Spieltag_${date}${event.opponent ? `_${event.opponent}` : ""}`
    : `Training_${date}`;
  return `${base.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_")}.pdf`;
}

export async function downloadEventPdf(event: EventDetail, players: PdfPlayer[], kit: KitColors) {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: fileName(event).replace(/\.pdf$/, ""), author: CLUB_NAME });

  drawHeader(doc, event, logo);

  const when = new Date(event.event_at);
  const info: [string, string][] = [
    ["Datum", format(when, "EEEE, d. MMMM yyyy", { locale: de })],
    ["Uhrzeit", `${format(when, "HH:mm")} Uhr`],
  ];
  if (event.event_type === "game") info.push(["Gegner", event.opponent ?? "-"]);
  info.push(["Mannschaft", event.groups?.name ?? "-"]);
  info.push(["Ort", event.location ?? "-"]);
  if (event.meeting_point) info.push(["Treffpunkt", event.meeting_point]);

  let y = 70;
  drawSectionTitle(doc, "Informationen", y);
  y += 6;
  const gap = 6;
  const rowGap = 4;
  const cardW = (CONTENT_W - gap) / 2;
  const cardH = 18;
  info.forEach(([label, value], i) => {
    const x = MARGIN + (i % 2) * (cardW + gap);
    drawInfoCard(doc, x, y + Math.floor(i / 2) * (cardH + rowGap), cardW, cardH, label, value);
  });
  y += Math.ceil(info.length / 2) * (cardH + rowGap) + 6;

  if (kit.shirt || kit.shorts || kit.socks) {
    drawSectionTitle(doc, "Trikots", y);
    y += 6;
    const kitW = (CONTENT_W - 2 * gap) / 3;
    const kitH = 19;
    const kitItems: [string, string][] = [["Trikot", kit.shirt], ["Hose", kit.shorts], ["Stutzen", kit.socks]];
    kitItems.forEach(([label, value], i) => drawKitCard(doc, MARGIN + i * (kitW + gap), y, kitW, kitH, label, value));
    y += kitH + 10;
  }

  drawSquad(doc, players, y, logo);
  drawFooters(doc);
  doc.save(fileName(event));
}
