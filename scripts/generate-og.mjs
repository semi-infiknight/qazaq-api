/**
 * Build og.png (static) and og.gif (animated loader) for Open Graph / Twitter cards.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import gifenc from "gifenc";
import { buildOgCardSvg } from "./og-card-svg.js";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const distDir = path.join(__dirname, "..", "dist");

const FRAMES = 28;
const FRAME_DELAY_MS = 70;

function frameParams(i) {
  const t = i / FRAMES;
  const ringRotation = t * 360;
  const dashOffset = -264 * t;
  const barScales = [0, 1, 2].map((j) => {
    const phase = t * Math.PI * 2 + j * 0.9;
    return 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(phase));
  });
  const barOpacities = barScales.map((s) => 0.25 + 0.75 * ((s - 0.68) / 0.32));
  return { ringRotation, dashOffset, barScales, barOpacities };
}

async function rasterizeSvg(svg) {
  const { data, info } = await sharp(Buffer.from(svg))
    .png()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function writePng(svg, outPath) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outPath);
}

async function writeGif(frames, outPath) {
  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const { data, width, height } = frames[i];
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay: FRAME_DELAY_MS,
      dispose: 2,
    });
  }
  gif.finish();
  fs.writeFileSync(outPath, Buffer.from(gif.bytes()));
}

async function main() {
  const mid = Math.floor(FRAMES / 2);
  const stillSvg = buildOgCardSvg(frameParams(mid));

  const targets = [publicDir];
  if (fs.existsSync(distDir)) targets.push(distDir);

  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true });
    await writePng(stillSvg, path.join(dir, "og.png"));
    console.log(`Wrote ${path.join(dir, "og.png")}`);
  }

  const rasterFrames = [];
  for (let i = 0; i < FRAMES; i++) {
    const svg = buildOgCardSvg(frameParams(i));
    rasterFrames.push(await rasterizeSvg(svg));
  }

  for (const dir of targets) {
    await writeGif(rasterFrames, path.join(dir, "og.gif"));
    console.log(`Wrote ${path.join(dir, "og.gif")} (${FRAMES} frames)`);
  }

  fs.writeFileSync(path.join(publicDir, "og.svg"), stillSvg);
  console.log(`Wrote ${path.join(publicDir, "og.svg")}`);
}

main().catch((err) => {
  console.error("[generate-og]", err);
  process.exit(1);
});
