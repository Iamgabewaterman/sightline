import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

const svg = readFileSync(join(iconsDir, "icon.svg"));

await sharp(svg).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));
console.log("✓ icon-512.png");

await sharp(svg).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));
console.log("✓ icon-192.png");
