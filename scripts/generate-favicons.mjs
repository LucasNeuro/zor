/**
 * Gera PNGs em public/favicons/ a partir do SVG da marca Waje.
 * Uso: node scripts/generate-favicons.mjs
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "favicons");
const svgPath = join(outDir, "waje-mark.svg");

const sizes = [16, 32, 48, 180, 192, 512];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const sharp = (await import("sharp")).default;
  const svg = readFileSync(svgPath);

  for (const size of sizes) {
    const out = join(outDir, `favicon-${size}x${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log("wrote", out);
  }

  await sharp(svg).resize(32, 32).png().toFile(join(outDir, "favicon.ico"));
  console.log("wrote favicon.ico (32px PNG alias)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
