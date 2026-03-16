import sharp from "sharp";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/splash");

const BG = "#0F0F0F";
const ORANGE = "#F97316";

// Common iPhone splash sizes (physical pixels)
const sizes = [
  { w: 750,  h: 1334, name: "750x1334"  }, // iPhone SE 3, 8
  { w: 828,  h: 1792, name: "828x1792"  }, // iPhone XR, 11
  { w: 1125, h: 2436, name: "1125x2436" }, // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  { w: 1170, h: 2532, name: "1170x2532" }, // iPhone 12, 13, 14
  { w: 1179, h: 2556, name: "1179x2556" }, // iPhone 14 Pro, 15 Pro
  { w: 1242, h: 2688, name: "1242x2688" }, // iPhone XS Max, 11 Pro Max
  { w: 1284, h: 2778, name: "1284x2778" }, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  { w: 1290, h: 2796, name: "1290x2796" }, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max
];

async function makeSplash({ w, h, name }) {
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  const r = Math.round(Math.min(w, h) * 0.055); // ~5.5% — roughly matches icon dot

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${BG}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${ORANGE}"/>
  </svg>`;

  const outPath = path.join(outDir, `splash-${name}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`✓ ${name}.png`);
}

for (const size of sizes) {
  await makeSplash(size);
}
console.log("Done.");
