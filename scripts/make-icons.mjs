import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Generates the app's raster icons from one drawing.
 *
 * The mark is the product's own image rather than a letterform: the cream page
 * that is the only lit thing on screen, with one marigold highlight on it. It
 * survives a rename, and at 48px on a home screen it still reads as a page
 * someone has marked up.
 *
 * Run with `npm run icons` after editing the source below.
 */

const INK = "#141312";
const PAPER = "#faf6ec";
const MARIGOLD = "#e9a13b";
const RULE = "#cdc4b2";

/**
 * @param {number} size
 * @param {boolean} maskable Full-bleed, with the art inside the safe zone —
 *   Android crops maskable icons to whatever shape the launcher uses.
 */
function svg(size, maskable) {
  // A maskable icon may be cropped to a circle inscribed in the middle 80%,
  // so the page is drawn smaller and the background runs to the edge.
  const pad = maskable ? 26 : 14;
  const radius = maskable ? 0 : 22;
  const w = 100 - pad * 2;
  const h = 100 - pad * 2;
  const x = pad;
  const y = pad;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" rx="${radius}" fill="${INK}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${PAPER}"/>
  <g fill="${RULE}">
    <rect x="${x + 7}" y="${y + 11}" width="${w - 14}" height="3.2" rx="1.6"/>
    <rect x="${x + 7}" y="${y + 20}" width="${w - 21}" height="3.2" rx="1.6"/>
    <rect x="${x + 7}" y="${y + 38}" width="${w - 17}" height="3.2" rx="1.6"/>
    <rect x="${x + 7}" y="${y + 47}" width="${w - 26}" height="3.2" rx="1.6"/>
  </g>
  <rect x="${x + 7}" y="${y + 27.4}" width="${w - 14}" height="6.4" rx="2" fill="${MARIGOLD}"/>
</svg>`);
}

const targets = [
  { file: "public/icon-192.png", size: 192, maskable: false },
  { file: "public/icon-512.png", size: 512, maskable: false },
  { file: "public/icon-maskable-512.png", size: 512, maskable: true },
  // Home-screen icon on iOS, which applies its own rounding and no transparency.
  { file: "app/apple-icon.png", size: 180, maskable: false },
];

await mkdir("public", { recursive: true });
for (const { file, size, maskable } of targets) {
  await sharp(svg(size, maskable)).png({ compressionLevel: 9 }).toFile(file);
  console.log("wrote", file, `${size}x${size}${maskable ? " (maskable)" : ""}`);
}

// The favicon stays vector — it's the one place the drawing scales for free.
await writeFile("app/icon.svg", svg(32, false).toString().replace(' width="32" height="32"', ""));
console.log("wrote app/icon.svg");
