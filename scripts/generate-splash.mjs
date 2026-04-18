import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splashDir = path.join(__dirname, "../public/splash");
const iconsDir  = path.join(__dirname, "../public/icons");

mkdirSync(splashDir, { recursive: true });

const BG = "#0F0F0F";

// ── Logo SVG (speed square + bubble level) ─────────────────────────────────
// Extracted from public/icons/icon.svg — original viewBox: 0 0 512 512.
// Background rect omitted so it composites cleanly over any solid fill.
const LOGO_SVG_CONTENT = `
  <polygon
    points="106,418 406,418 256,118"
    fill="none" stroke="white" stroke-width="44"
    stroke-linejoin="miter" stroke-miterlimit="4"
  />
  <line x1="286" y1="178" x2="304" y2="169" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="316" y1="238" x2="334" y2="229" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="346" y1="298" x2="364" y2="289" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="376" y1="358" x2="394" y2="349" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <rect x="106" y="48" width="300" height="70" rx="10"
    fill="${BG}" stroke="white" stroke-width="12"/>
  <path d="M 160 108 Q 256 62 352 108"
    fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="256" cy="83" rx="28" ry="15" fill="#F97316"/>
`;

// ── Apple touch icon: 180×180 PNG ──────────────────────────────────────────
async function makeAppleTouchIcon() {
  const size = 180;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="${BG}"/>
    ${LOGO_SVG_CONTENT}
  </svg>`;

  const outPath = path.join(iconsDir, "apple-touch-icon.png");
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
  console.log("✓ apple-touch-icon.png (180x180)");
}

// ── Splash screens ─────────────────────────────────────────────────────────
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

  // Logo: 40% of screen width, centered
  const iconSize = Math.round(w * 0.40);

  // Tagline font size: ~4% of screen width, minimum 28px
  const fontSize = Math.max(28, Math.round(w * 0.038));

  // Spacing between logo bottom and tagline baseline
  const gap = Math.round(iconSize * 0.18);

  // Total vertical height of the logo + gap + one line of text
  const totalH = iconSize + gap + fontSize;

  // Center the whole group vertically
  const groupTop = Math.round((h - totalH) / 2);

  const logoX = Math.round((w - iconSize) / 2);
  const logoY = groupTop;

  // SVG text y is the baseline; add font-size to move below logo
  const textY = groupTop + iconSize + gap + fontSize;

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${BG}"/>

    <!-- Logo icon -->
    <svg x="${logoX}" y="${logoY}" width="${iconSize}" height="${iconSize}" viewBox="0 0 512 512">
      ${LOGO_SVG_CONTENT}
    </svg>

    <!-- Tagline -->
    <text
      x="${cx}"
      y="${textY}"
      text-anchor="middle"
      font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="400"
      letter-spacing="${Math.round(w * 0.004)}"
      fill="#6B7280"
    >Every job. One view.</text>
  </svg>`;

  const outPath = path.join(splashDir, `splash-${name}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`✓ splash-${name}.png`);
}

await makeAppleTouchIcon();
for (const size of sizes) {
  await makeSplash(size);
}
console.log("Done.");
