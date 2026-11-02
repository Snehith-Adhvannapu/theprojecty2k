// One-off: turns the supplied photos into web-sized WebP files in public/images.
// node scripts/prep-images.cjs
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = "C:/Users/ADMIN/.claude/uploads/07c10e25-7e9d-4163-9a3a-e118fefcf74d";
const OUT = path.join(process.cwd(), "public", "images");
fs.mkdirSync(OUT, { recursive: true });

const jobs = [
  ["7abf9fa5-image.jpg", "hero.webp", 960],
  ["af5168dd-image.jpg", "last-blue.webp", 900],
  ["a67aeaaf-image.jpg", "last-smoke.webp", 900],
  ["1cf42b58-image.jpg", "last-dj.webp", 720],
  ["3c36602e-image.jpg", "last-crowd.webp", 416],
];

(async () => {
  for (const [file, out, w] of jobs) {
    const info = await sharp(path.join(SRC, file)).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(OUT, out));
    console.log(out, info.width + "x" + info.height, Math.round(info.size / 1024) + "KB");
  }
  // Merchant QR: crop just the code out of the PhonePe screenshot (no bank name, no app chrome).
  const qr = await sharp(path.join(SRC, "994a525c-image.jpg")).extract({ left: 165, top: 782, width: 390, height: 390 }).extend({ top: 30, bottom: 30, left: 30, right: 30, background: "#ffffff" }).png().toFile(path.join(OUT, "merchant-qr.png"));
  console.log("merchant-qr.png", qr.width + "x" + qr.height);
})();
