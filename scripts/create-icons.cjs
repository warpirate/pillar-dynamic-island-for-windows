/**
 * Generate app icons from `public/pillar.svg` for:
 * - Web: `public/pillar-*.png` (optional, but handy)
 * - Tauri/Windows: `src-tauri/icons/icon.ico` + `src-tauri/icons/icon.png`
 *
 * Run: `npm run icons`
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const root = path.join(__dirname, "..");
const srcSvg = path.join(root, "public", "pillar.svg");

const tauriIconsDir = path.join(root, "src-tauri", "icons");
const outIco = path.join(tauriIconsDir, "icon.ico");
const outPng = path.join(tauriIconsDir, "icon.png");

const webOutDir = path.join(root, "public");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function renderPng(size, outPath) {
  const svg = fs.readFileSync(srcSvg);
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(srcSvg)) {
    throw new Error(`Missing source SVG: ${srcSvg}`);
  }

  ensureDir(tauriIconsDir);

  // Tauri icon.png (commonly used by some bundles/tools)
  await renderPng(512, outPng);

  // Web PNGs (optional)
  await renderPng(192, path.join(webOutDir, "pillar-192.png"));
  await renderPng(512, path.join(webOutDir, "pillar-512.png"));

  // Windows ICO should contain multiple sizes for crisp taskbar/tray
  const tmpDir = path.join(root, ".tmp-icons");
  ensureDir(tmpDir);

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = [];
  for (const s of sizes) {
    const p = path.join(tmpDir, `pillar-${s}.png`);
    await renderPng(s, p);
    pngPaths.push(p);
  }

  const icoBuf = await pngToIco(pngPaths);
  fs.writeFileSync(outIco, icoBuf);

  // cleanup (best-effort)
  try {
    for (const p of pngPaths) fs.unlinkSync(p);
    fs.rmdirSync(tmpDir);
  } catch (_) {}

  console.log("Generated:");
  console.log(" -", path.relative(root, outIco));
  console.log(" -", path.relative(root, outPng));
  console.log(" - public/pillar.svg (favicon)");
  console.log(" - public/pillar-192.png");
  console.log(" - public/pillar-512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

