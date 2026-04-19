import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splashDir = path.join(__dirname, "../public/splash");
const iconsDir  = path.join(__dirname, "../public/icons");
const logoSrc   = path.join(__dirname, "../public/new-logo.png.png");

mkdirSync(splashDir, { recursive: true });

const BG = { r: 15, g: 15, b: 15 }; // #0F0F0F

// Logo source aspect ratio: 1408 × 768
const LOGO_ASPECT = 768 / 1408;

// ── Apple touch icon: 180×180 PNG ──────────────────────────────────────────
async function makeAppleTouchIcon() {
  // For the square icon, fit the logo inside with dark padding
  const size = 180;
  const logoW = Math.round(size * 0.85);
  const logoH = Math.round(logoW * LOGO_ASPECT);
  const logoX = Math.round((size - logoW) / 2);
  const logoY = Math.round((size - logoH) / 2);

  const logoBuffer = await sharp(logoSrc)
    .resize(logoW, logoH, { fit: "contain", background: { ...BG, alpha: 0 } })
    .png()
    .toBuffer();

  const outPath = path.join(iconsDir, "apple-touch-icon.png");
  await sharp({
    create: { width: size, height: size, channels: 4, background: { ...BG, alpha: 255 } },
  })
    .composite([{ input: logoBuffer, left: logoX, top: logoY }])
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

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
  // Logo: 57.5% of screen width (fills 55-60% as requested)
  const logoW = Math.round(w * 0.575);
  const logoH = Math.round(logoW * LOGO_ASPECT);

  const logoX = Math.round((w - logoW) / 2);

  // Tagline below the logo
  const fontSize = Math.max(28, Math.round(w * 0.038));
  const gap = Math.round(logoH * 0.18);
  const totalH = logoH + gap + fontSize;

  // Center the whole group vertically
  const groupTop = Math.round((h - totalH) / 2);
  const logoY = groupTop;
  const textY = groupTop + logoH + gap + fontSize;
  const cx = Math.round(w / 2);
  const letterSpacing = Math.round(w * 0.004);

  // Resize logo, preserving transparency
  const logoBuffer = await sharp(logoSrc)
    .resize(logoW, logoH, { fit: "contain", background: { ...BG, alpha: 0 } })
    .png()
    .toBuffer();

  // Tagline SVG overlay
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

await makeAppleTouchIcon();
for (const size of sizes) {
  await makeSplash(size);
}
console.log("Done.");
