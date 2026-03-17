import sharp from 'sharp';
import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const toIco = require('to-ico');

const LOGO = 'public/new-logo.png.png';
const BG   = { r: 15, g: 15, b: 15, alpha: 1 };   // #0F0F0F
const ORANGE = { r: 249, g: 115, b: 22 };           // #F97316

// Threshold: pixels with luminance above this are treated as background (→ transparent)
// Logo background is ~242–249; ink is ~0–10; anti-aliasing is in between.
const TRANSPARENT_ABOVE = 200;

/**
 * Returns an RGBA Buffer where:
 *  - near-white background pixels → fully transparent
 *  - dark ink pixels → fully opaque orange
 *  - edge anti-aliasing → smooth alpha transition
 */
async function tintedLogoBuffer(fitW, fitH) {
  const { data, info } = await sharp(LOGO)
    .resize(fitW, fitH, { fit: 'inside', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const lum = data[i]; // 0 = black ink, 255 = white bg

    let alpha;
    if (lum >= TRANSPARENT_ABOVE) {
      alpha = 0; // fully transparent — background pixel
    } else {
      // Remap 0–TRANSPARENT_ABOVE → 255–0  (dark ink = fully opaque)
      alpha = Math.round((1 - lum / TRANSPARENT_ABOVE) * 255);
    }

    rgba[i * 4 + 0] = ORANGE.r;
    rgba[i * 4 + 1] = ORANGE.g;
    rgba[i * 4 + 2] = ORANGE.b;
    rgba[i * 4 + 3] = alpha;
  }

  return { rgba, width, height };
}

async function makeSquareIcon(outPath, size) {
  const padding = Math.round(size * 0.15);
  const fitSize = size - padding * 2;
  const { rgba, width, height } = await tintedLogoBuffer(fitSize, fitSize);
  const left = Math.round((size - width) / 2);
  const top  = Math.round((size - height) / 2);

  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, left, top }])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

async function makeSplash(outPath, w, h) {
  const shorter  = Math.min(w, h);
  const fitSize  = Math.round(shorter * 0.55);
  const { rgba, width, height } = await tintedLogoBuffer(fitSize, fitSize);
  const left = Math.round((w - width) / 2);
  const top  = Math.round((h - height) / 2);

  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, left, top }])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

console.log('Generating icons…');
await makeSquareIcon('public/favicon.png', 32);
await makeSquareIcon('public/apple-touch-icon.png', 180);
await makeSquareIcon('public/icons/icon-192.png', 192);
await makeSquareIcon('public/icons/icon-512.png', 512);

// BrandLogo image — wider aspect for the login/header component
// Logo is landscape (1408×768), so use a wider crop area for the brand display
{
  const W = 480; const H = 260;
  const fitW = 420; const fitH = 220;
  const { rgba, width, height } = await tintedLogoBuffer(fitW, fitH);
  const left = Math.round((W - width) / 2);
  const top  = Math.round((H - height) / 2);
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, left, top }])
    .png()
    .toFile('public/icons/brand-logo.png');
  console.log('  wrote public/icons/brand-logo.png');
}

// favicon.ico
console.log('  generating favicon.ico…');
const ico16 = await (async () => {
  const { rgba, width, height } = await tintedLogoBuffer(12, 12);
  const l = Math.round((16 - width) / 2), t = Math.round((16 - height) / 2);
  return sharp({ create: { width: 16, height: 16, channels: 4, background: BG } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, left: l, top: t }])
    .png().toBuffer();
})();
const ico32 = await (async () => {
  const { rgba, width, height } = await tintedLogoBuffer(24, 24);
  const l = Math.round((32 - width) / 2), t = Math.round((32 - height) / 2);
  return sharp({ create: { width: 32, height: 32, channels: 4, background: BG } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, left: l, top: t }])
    .png().toBuffer();
})();
writeFileSync('public/favicon.ico', await toIco([ico16, ico32]));
console.log('  wrote public/favicon.ico');

console.log('Generating splash screens…');
const splashes = [
  [750, 1334], [828, 1792], [1125, 2436], [1170, 2532],
  [1179, 2556], [1242, 2688], [1284, 2778], [1290, 2796],
];
for (const [w, h] of splashes) {
  await makeSplash(`public/splash/splash-${w}x${h}.png`, w, h);
}

console.log('Done.');
