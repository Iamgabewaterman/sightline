import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splashDir = path.join(__dirname, "../public/splash");
const iconsDir  = path.join(__dirname, "../public/icons");

mkdirSync(splashDir, { recursive: true });

const BG = { r: 15, g: 15, b: 15 }; // #0F0F0F

// Orange-on-dark version of the Sightline icon — all strokes/fills #F97316
// Used as the logo source for splash screens so colors match the app exactly
const ORANGE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0F0F0F"/>
  <polygon points="106,418 406,418 256,118" fill="none" stroke="#F97316" stroke-width="44" stroke-linejoin="miter" stroke-miterlimit="4"/>
  <line x1="286" y1="178" x2="304" y2="169" stroke="#F97316" stroke-width="5" stroke-linecap="round"/>
  <text x="310" y="166" fill="#F97316" font-size="20" font-family="sans-serif" font-weight="700" transform="rotate(63, 310, 166)">4</text>
  <line x1="316" y1="238" x2="334" y2="229" stroke="#F97316" stroke-width="5" stroke-linecap="round"/>
  <text x="340" y="226" fill="#F97316" font-size="20" font-family="sans-serif" font-weight="700" transform="rotate(63, 340, 226)">8</text>
  <line x1="346" y1="298" x2="364" y2="289" stroke="#F97316" stroke-width="5" stroke-linecap="round"/>
  <text x="369" y="286" fill="#F97316" font-size="20" font-family="sans-serif" font-weight="700" transform="rotate(63, 369, 286)">12</text>
  <line x1="376" y1="358" x2="394" y2="349" stroke="#F97316" stroke-width="5" stroke-linecap="round"/>
  <text x="399" y="346" fill="#F97316" font-size="20" font-family="sans-serif" font-weight="700" transform="rotate(63, 399, 346)">16</text>
  <rect x="106" y="48" width="300" height="70" rx="10" fill="#0F0F0F" stroke="#F97316" stroke-width="12"/>
  <path d="M 160 108 Q 256 62 352 108" fill="none" stroke="#F97316" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="256" cy="83" rx="28" ry="15" fill="#F97316"/>
</svg>`;

// Pre-render the orange SVG icon to a PNG buffer (512×512, square)
const LOGO_BUFFER = await sharp(Buffer.from(ORANGE_ICON_SVG)).png().toBuffer();
const LOGO_ASPECT = 1; // icon is square

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
  // Icon: 38% of the shorter screen dimension, centred
  const logoSize = Math.round(Math.min(w, h) * 0.38);

  const logoBuffer = await sharp(LOGO_BUFFER)
    .resize(logoSize, logoSize, { fit: "contain", background: { ...BG, alpha: 1 } })
    .png()
    .toBuffer();

  const logoX = Math.round((w - logoSize) / 2);

  // Tagline below the icon
  const fontSize = Math.max(28, Math.round(w * 0.038));
  const gap = Math.round(logoSize * 0.18);
  const totalH = logoSize + gap + fontSize;
  const groupTop = Math.round((h - totalH) / 2);
  const logoY = groupTop;
  const textY = groupTop + logoSize + gap + fontSize;
  const cx = Math.round(w / 2);
  const letterSpacing = Math.round(w * 0.004);

  const taglineSvg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${cx}" y="${textY}"
        text-anchor="middle"
        font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="400"
        letter-spacing="${letterSpacing}"
        fill="#6B7280"
      >Every job. One view.</text>
    </svg>`
  );

  const outPath = path.join(splashDir, `splash-${name}.png`);

  await sharp({
    create: { width: w, height: h, channels: 3, background: BG },
  })
    .composite([
      { input: logoBuffer, left: logoX, top: logoY },
      { input: taglineSvg, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`✓ splash-${name}.png`);
}

for (const size of sizes) {
  await makeSplash(size);
}
console.log("Done.");
