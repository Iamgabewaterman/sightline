import sharp from 'sharp';

const LOGO = 'public/new-logo.png.png';
const BG = { r: 15, g: 15, b: 15, alpha: 1 };

async function makeIcon(outPath, size) {
  const padding = Math.round(size * 0.12);
  const fitSize = size - padding * 2;
  const { data, info } = await sharp(LOGO)
    .resize(fitSize, fitSize, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((size - info.width) / 2);
  const top = Math.round((size - info.height) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: data, raw: { width: info.width, height: info.height, channels: 4 }, left, top }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${outPath}`);
}

async function makeSplash(outPath, w, h) {
  const shorter = Math.min(w, h);
  const fitSize = Math.round(shorter * 0.55);
  const { data, info } = await sharp(LOGO)
    .resize(fitSize, fitSize, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((w - info.width) / 2);
  const top = Math.round((h - info.height) / 2);
  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{ input: data, raw: { width: info.width, height: info.height, channels: 4 }, left, top }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${outPath}`);
}

// apple-touch-icon
await makeIcon('public/apple-touch-icon.png', 180);

// favicon (32x32 ico-like png used as favicon)
await makeIcon('public/favicon.png', 32);

// splash screens
const splashes = [
  [750, 1334],
  [828, 1792],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
];
for (const [w, h] of splashes) {
  await makeSplash(`public/splash/splash-${w}x${h}.png`, w, h);
}

console.log('done');
