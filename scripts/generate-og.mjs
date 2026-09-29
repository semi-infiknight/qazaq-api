/**
 * Capture the live home hero (Khazak arch + logo wall) into og.gif / og.png for /og.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const FRAMES = 40;
const FRAME_DELAY_MS = 90;
const CAPTURE_PORT = Number(process.env.OG_CAPTURE_PORT) || 9876;

async function waitForHealth(port) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("OG capture server did not become healthy");
}

function startProdServer(port) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [path.join(rootDir, "server", "index.js")], {
      env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let bootLog = "";
    proc.stderr?.on("data", (chunk) => {
      bootLog += chunk.toString();
    });
    proc.on("error", reject);
    waitForHealth(port)
      .then(() => resolve(proc))
      .catch((err) => {
        proc.kill();
        reject(new Error(`${err.message}\n${bootLog}`));
      });
  });
}

async function pngToRaw(pngBuffer) {
  const resized = await sharp(pngBuffer)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: resized.data, width: resized.info.width, height: resized.info.height };
}

async function writeGif(frames, outPath) {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const { data, width, height } = frame;
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

async function writePngFromRaw({ data, width, height }, outPath) {
  await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`[generate-og] Wrote ${outPath}`);
}

async function captureHeroFrames() {
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    throw new Error("dist/index.html missing — run vite build first");
  }

  const { chromium } = await import("playwright");
  const server = await startProdServer(CAPTURE_PORT);
  const url = `http://127.0.0.1:${CAPTURE_PORT}/`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1200, height: 920 },
      deviceScaleFactor: 1,
    });
    await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector(".hero-arch .kz-af", { timeout: 30_000 });
    await page.waitForTimeout(2800);

    const hero = page.locator(".hero-arch");
    const box = await hero.boundingBox();
    if (!box || box.width < 100 || box.height < 100) {
      throw new Error("hero-arch bounding box missing or too small");
    }

    const clip = {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, 1200),
      height: box.height,
    };

    const frames = [];
    for (let i = 0; i < FRAMES; i++) {
      const png = await page.screenshot({ type: "png", clip, animations: "disabled" });
      frames.push(await pngToRaw(png));
      await page.waitForTimeout(FRAME_DELAY_MS);
    }
    return frames;
  } finally {
    await browser?.close().catch(() => {});
    server.kill("SIGTERM");
  }
}

function copyExistingToDist() {
  for (const name of ["og.gif", "og.png"]) {
    const src = path.join(publicDir, name);
    const dest = path.join(distDir, name);
    if (fs.existsSync(src) && fs.existsSync(distDir)) {
      fs.copyFileSync(src, dest);
    }
  }
}

async function main() {
  if (process.env.SKIP_OG_CAPTURE === "1") {
    console.log("[generate-og] SKIP_OG_CAPTURE=1 — copying existing public/og.* to dist");
    copyExistingToDist();
    return;
  }

  let frames;
  try {
    frames = await captureHeroFrames();
  } catch (err) {
    console.warn("[generate-og] Hero capture failed:", err.message);
    if (fs.existsSync(path.join(publicDir, "og.gif"))) {
      console.warn("[generate-og] Keeping committed public/og.gif");
      copyExistingToDist();
      return;
    }
    throw err;
  }

  const mid = Math.floor(frames.length / 2);
  const targets = [publicDir];
  if (fs.existsSync(distDir)) targets.push(distDir);

  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true });
    await writePngFromRaw(frames[mid], path.join(dir, "og.png"));
    await writeGif(frames, path.join(dir, "og.gif"));
    console.log(`[generate-og] Wrote ${path.join(dir, "og.gif")} (${FRAMES} frames, home hero)`);
  }
}

main().catch((err) => {
  console.error("[generate-og]", err);
  process.exit(1);
});
