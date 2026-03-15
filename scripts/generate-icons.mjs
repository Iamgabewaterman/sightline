import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

const svg = readFileSync(join(iconsDir, "icon.svg"), "utf-8");

function render(svgStr, size, outPath) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: "width", value: size },
  });
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath.split(/[\\/]/).pop()} (${size}×${size})`);
}

render(svg, 512, join(iconsDir, "icon-512.png"));
render(svg, 192, join(iconsDir, "icon-192.png"));
