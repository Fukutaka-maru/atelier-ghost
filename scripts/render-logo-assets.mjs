import sharp from "sharp";
import { fileURLToPath } from "node:url";

const outDir = new URL("../public/images/", import.meta.url);

const white = "#ffffff";
const black = "#111215";
const previewBg = "#2c3440";
const fontFamily = "Helvetica Neue, Helvetica, Arial, sans-serif";

function letter(char, x, y, size, color) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${fontFamily}" font-size="${size}" font-weight="200" dominant-baseline="middle" text-anchor="middle">${char}</text>`;
}

function crosslessA(x, y, size, color) {
  const h = size * 0.69;
  const w = size * 0.53;
  const stroke = size * 0.066;
  const topY = y - h / 2 + size * 0.05;
  const bottomY = y + h / 2 + size * 0.05;
  return `
    <path d="M ${x - w / 2} ${bottomY} L ${x} ${topY} L ${x + w / 2} ${bottomY}"
      fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="butt" stroke-linejoin="miter" />
  `;
}

function dashedO(x, y, size, color) {
  const r = size * 0.39;
  const dashWidth = size * 0.13;
  const dashHeight = size * 0.06;
  const cy = y + size * 0.02;
  return Array.from({ length: 12 }, (_, index) => {
    const angle = index * 30;
    return `<rect x="${x - dashWidth / 2}" y="${cy - r - dashHeight / 2}" width="${dashWidth}" height="${dashHeight}" fill="${color}" transform="rotate(${angle} ${x} ${cy})" />`;
  }).join("");
}

function logoInlineSvg(color = white) {
  const size = 46;
  const y = 78;
  const xs = [44, 108, 172, 236, 300, 364, 428, 506, 570, 634, 698, 762];
  const chars = ["A", "T", "E", "L", "I", "E", "R", "G", "H", "O", "S", "T"];
  const marks = chars.map((char, index) => {
    if (char === "A") return crosslessA(xs[index], y, size, color);
    if (char === "O") return dashedO(xs[index], y, size, color);
    return letter(char, xs[index], y, size, color);
  }).join("");

  return `
  <svg width="812" height="156" viewBox="0 0 812 156" xmlns="http://www.w3.org/2000/svg">
    ${marks}
  </svg>`;
}

function logoStackedSvg(color = white) {
  const size = 62;
  const y1 = 86;
  const y2 = 188;
  const topXs = centeredXs(430, 118, 7);
  const bottomXs = centeredXs(430, 148, 5);
  const top = ["A", "T", "E", "L", "I", "E", "R"].map((char, index) => (
    char === "A" ? crosslessA(topXs[index], y1, size, color) : letter(char, topXs[index], y1, size, color)
  )).join("");
  const bottom = ["G", "H", "O", "S", "T"].map((char, index) => (
    char === "O" ? dashedO(bottomXs[index], y2, size, color) : letter(char, bottomXs[index], y2, size, color)
  )).join("");

  return `
  <svg width="860" height="274" viewBox="0 0 860 274" xmlns="http://www.w3.org/2000/svg">
    ${top}
    ${bottom}
  </svg>`;
}

function centeredXs(center, gap, count) {
  const start = center - gap * (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => start + gap * index);
}

async function savePng(name, svg) {
  const file = new URL(name, outDir);
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(file));
  return file;
}

async function savePreview(name, logoName) {
  const logoUrl = new URL(logoName, outDir);
  const logoPath = fileURLToPath(logoUrl);
  const logo = await sharp(logoPath).metadata();
  const pad = 56;
  const bg = {
    create: {
      width: logo.width + pad * 2,
      height: logo.height + pad * 2,
      channels: 4,
      background: previewBg,
    },
  };
  await sharp(bg)
    .composite([{ input: logoPath, left: pad, top: pad }])
    .png()
    .toFile(fileURLToPath(new URL(name, outDir)));
}

async function saveInstagramProfiles() {
  const size = 1080;
  const blackLogo = await sharp(Buffer.from(logoStackedSvg(black))).png().resize({ width: 720 }).toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#fbfbfb",
    },
  })
    .composite([{ input: blackLogo, gravity: "center" }])
    .png()
    .toFile(fileURLToPath(new URL("instagram-profile-white-black-logo.png", outDir)));

  const whiteLogo = await sharp(Buffer.from(logoInlineSvg(white))).png().resize({ width: 760 }).toBuffer();
  await sharp(fileURLToPath(new URL("statement-bg.png", outDir)))
    .resize(size, size, { fit: "cover" })
    .modulate({ saturation: 0.9, brightness: 0.92 })
    .blur(1.2)
    .composite([
      {
        input: Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgba(22,32,46,.22)"/></svg>`),
        left: 0,
        top: 0,
      },
      { input: whiteLogo, gravity: "center" },
    ])
    .png()
    .toFile(fileURLToPath(new URL("instagram-profile-bubble-white-logo.png", outDir)));
}

await savePng("atelier-ghost-logo-white-inline.png", logoInlineSvg(white));
await savePng("atelier-ghost-logo-white-stacked.png", logoStackedSvg(white));
await savePng("atelier-ghost-logo-black-inline.png", logoInlineSvg(black));
await savePng("atelier-ghost-logo-black-stacked.png", logoStackedSvg(black));
await savePreview("atelier-ghost-logo-white-inline-preview.png", "atelier-ghost-logo-white-inline.png");
await savePreview("atelier-ghost-logo-white-stacked-preview.png", "atelier-ghost-logo-white-stacked.png");
await saveInstagramProfiles();

console.log("public/images/atelier-ghost-logo-white-inline.png");
console.log("public/images/atelier-ghost-logo-white-stacked.png");
console.log("public/images/instagram-profile-white-black-logo.png");
console.log("public/images/instagram-profile-bubble-white-logo.png");
