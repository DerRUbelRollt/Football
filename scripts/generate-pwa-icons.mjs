import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const iconsDir = join(publicDir, "icons");
const source = join(publicDir, "Football.png");

// Matches --background (dark) in src/styles.css, used to flatten transparency
// for the Apple touch icon and as the maskable icon's safe-zone padding.
const DARK_BG = "#0a0e11";

await mkdir(iconsDir, { recursive: true });

await sharp(source).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));

await sharp(source).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));

// Maskable icon: ~10% padding on each side so adaptive icon masks (Android)
// don't clip the artwork.
await sharp(source)
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: DARK_BG })
  .png()
  .toFile(join(iconsDir, "icon-512-maskable.png"));

// Apple touch icon: flattened onto the app background, no alpha channel.
await sharp(source)
  .resize(180, 180)
  .flatten({ background: DARK_BG })
  .png()
  .toFile(join(iconsDir, "apple-touch-icon.png"));

// Replace the old low-res favicon.ico with a PNG-in-ICO generated from the same source.
await sharp(source).resize(256, 256).png().toFile(join(publicDir, "favicon.ico"));

console.log("PWA icons generated in public/icons/ and public/favicon.ico updated.");
