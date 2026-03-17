import sharp from 'sharp';
import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const toIco = require('to-ico');

const LOGO = 'public/new-logo.png.png';
const BG = { r: 15, g: 15, b: 15, alpha: 1 };
const ORANGE = { r: 249, g: 115, b: 22 }; // #F97316

/**
 * Produce an RGBA Buffer of the logo tinted orange on transparent background.
 * Strategy: flatten white bg, grayscale, negate → use as alpha over solid orange.
 */
async function tintedLogoBuffer(fitWidth, fitHeight) {
  const { data, info } = await sharp(LOGO)
    .resize(fitWidth, fitHeight, { fit: 'inside', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .negate()                     // white bg → 0 (transparent), dark lines → 255 (opaque)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const alpha = data[i];
    rgba[i * 4 + 0] = ORANGE.r;
    rgba[i * 4 + 1] = ORANGE.g;
    rgba[i * 4 + 2] = ORANGE.b;
    rgba[i * 4 + 3] = alpha;
  }
  return { rgba, width, height };
}

/**
 * Place tinted logo centered on a #0F0F0F square of `size`.
 */
async function makeSquareIcon(outPath, size) {
  const padding = Math.round(size * 0.15);
  const fitSize = size - padding * 2;
  const { rgba, width, height } = await tintedLogoBuffer(fitSize, fitSize);
  const left = Math.round((size - width) / 2);
  const top = Math.round((size - height) / 2);

  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: rgba, raw: { width, height, channels: 4 }, left, top }])
    .png()
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

/**
 * Place tinted logo centered on a #0F0F0F canvas of w×h.
 */
async function makeSplash(outPath, w, h) {
  const shorter = Math.min(w, h);
  const fitSize = Math.round(shorter * 0.55);
  const { rgba, width, height } = await tintedLogoBuffer(fitSize, fitSize);
  const left = Math.round((w - width) / 2);
  const top = Math.round((h - height) / 2);

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

// favicon.ico (16 + 32px PNGs bundled)
console.log('  generating favicon.ico…');
const ico16 = await sharp({ create: { width: 16, height: 16, channels: 4, background: BG } })
  .composite([await (async () => {
    const { rgba, width, height } = await tintedLogoBuffer(12, 12);
    return { input: rgba, raw: { width, height, channels: 4 }, left: Math.round((16 - width) / 2), top: Math.round((16 - height) / 2) };
  })()])
  .png()
  .toBuffer();
const ico32 = await sharp({ create: { width: 32, height: 32, channels: 4, background: BG } })
  .composite([await (async () => {
    const { rgba, width, height } = await tintedLogoBuffer(24, 24);
    return { input: rgba, raw: { width, height, channels: 4 }, left: Math.round((32 - width) / 2), top: Math.round((32 - height) / 2) };
  })()])
  .png()
  .toBuffer();
const icoData = await toIco([ico16, ico32]);
writeFileSync('public/favicon.ico', icoData);
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
