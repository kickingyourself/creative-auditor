/**
 * generate-favicon.mjs
 * Converts /public/pmg_logo_white.svg → app/favicon.ico
 * Uses sharp (already in devDeps) to render SVG → PNG, then packs a proper
 * multi-size ICO (16, 32, 48) using a minimal hand-rolled ICO writer.
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const SVG_PATH = join(__dir, "public", "pmg_logo_white.svg");
const OUT_PATH = join(__dir, "app", "favicon.ico");

// ── 1. Build a padded SVG with a dark background ──────────────────────────────
// The raw SVG is white-on-transparent; favicons need a solid background.
const BG = "#0f1f20";   // deep teal-dark, matches app dark chrome
const LOGO = "#ffffff";

// We wrap the original path in a new SVG that adds a square background rect.
const originalSvg = readFileSync(SVG_PATH, "utf8");
// Extract just the path data (the d attribute)
const pathMatch = originalSvg.match(/d="([^"]+)"/);
if (!pathMatch) throw new Error("Could not extract path from SVG");
const pathData = pathMatch[1];

// Build a clean square SVG (viewBox centered on the logo with 15% padding)
const composedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 80 64">
  <rect x="-6" y="-6" width="80" height="64" fill="${BG}" rx="8"/>
  <path d="${pathData}" fill="${LOGO}"/>
</svg>`;

const svgBuffer = Buffer.from(composedSvg);

// ── 2. Render to PNG at each required size ────────────────────────────────────
const SIZES = [16, 32, 48];

const pngBuffers = await Promise.all(
  SIZES.map((size) =>
    sharp(svgBuffer)
      .resize(size, size, { fit: "contain", background: BG })
      .png({ compressionLevel: 9 })
      .toBuffer()
  )
);

console.log("Rendered PNG sizes:", pngBuffers.map((b, i) => `${SIZES[i]}×${SIZES[i]} (${b.length}B)`).join(", "));

// ── 3. Pack into ICO ──────────────────────────────────────────────────────────
// ICO format reference: https://en.wikipedia.org/wiki/ICO_(file_format)
// Header: 6 bytes
//   - reserved:  UInt16LE = 0
//   - type:      UInt16LE = 1 (icon)
//   - count:     UInt16LE = number of images
// Directory: 16 bytes per image
//   - width:     UInt8 (0 = 256)
//   - height:    UInt8 (0 = 256)
//   - colorCount:UInt8 = 0
//   - reserved:  UInt8 = 0
//   - planes:    UInt16LE = 1
//   - bitCount:  UInt16LE = 32
//   - sizeInBytes:  UInt32LE
//   - fileOffset:   UInt32LE

const count = pngBuffers.length;
const headerSize = 6;
const dirEntrySize = 16;
const dirSize = count * dirEntrySize;
const totalHeader = headerSize + dirSize;

// Calculate total buffer size
const totalSize = totalHeader + pngBuffers.reduce((s, b) => s + b.length, 0);
const ico = Buffer.alloc(totalSize);

// Write header
ico.writeUInt16LE(0, 0);       // reserved
ico.writeUInt16LE(1, 2);       // type = icon
ico.writeUInt16LE(count, 4);   // image count

let dirOffset = headerSize;
let dataOffset = totalHeader;

for (let i = 0; i < count; i++) {
  const size = SIZES[i];
  const buf = pngBuffers[i];
  const w = size >= 256 ? 0 : size;
  const h = size >= 256 ? 0 : size;

  ico.writeUInt8(w, dirOffset + 0);
  ico.writeUInt8(h, dirOffset + 1);
  ico.writeUInt8(0, dirOffset + 2);   // color count
  ico.writeUInt8(0, dirOffset + 3);   // reserved
  ico.writeUInt16LE(1, dirOffset + 4); // planes
  ico.writeUInt16LE(32, dirOffset + 6); // bit count
  ico.writeUInt32LE(buf.length, dirOffset + 8);  // size
  ico.writeUInt32LE(dataOffset, dirOffset + 12); // offset

  buf.copy(ico, dataOffset);

  dirOffset += dirEntrySize;
  dataOffset += buf.length;
}

writeFileSync(OUT_PATH, ico);
console.log(`✅ Wrote ${OUT_PATH} (${ico.length} bytes, ${count} sizes)`);
