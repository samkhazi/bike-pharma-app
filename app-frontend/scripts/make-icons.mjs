// Draws the source artwork that `npx @capacitor/assets generate` turns into every iOS and Android icon and launch screen.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const yellow = "#f6c31c";
const ink = "#1b1c1f";
const spanner = `
  <path d="M563.54,85Q477.07,0,322,0,171.8,0,83.41,85.66,15.78,151.34.32,251.82H142.66a191.29,191.29,0,0,1,180-125.59c105.94,0,192.24,86,192.24,192.25s-86.3,192.24-192.24,192.24A191.78,191.78,0,0,1,142,383.85H0c10,69.23,37,125.26,80.83,168.74q86,84.52,236,84.37Q471.93,637,561,553.23q88.88-84,88.88-227.67Q649.84,170.51,563.54,85Z"/>
  <polygon points="302.3 403.24 582.62 403.24 582.62 233.7 302.3 233.7 253.36 318.47 302.3 403.24"/>`;
const mark = { w: 650, h: 637 };

function art(size, share, background) {
  const scale = (size * share) / mark.w;
  const x = (size - mark.w * scale) / 2;
  const y = (size - mark.h * scale) / 2;
  const bg = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : "";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg}<g fill="${ink}" transform="translate(${x} ${y}) scale(${scale})">${spanner}</g></svg>`,
  );
}

function plain(size, colour) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${colour}"/></svg>`);
}

mkdirSync("assets", { recursive: true });
await sharp(art(1024, 0.56, yellow)).flatten({ background: yellow }).png().toFile("assets/icon-only.png");
await sharp(art(1024, 0.4, null)).png().toFile("assets/icon-foreground.png");
await sharp(plain(1024, yellow)).png().toFile("assets/icon-background.png");
await sharp(plain(2732, "#ffffff")).png().toFile("assets/splash.png");
await sharp(plain(2732, "#1a1917")).png().toFile("assets/splash-dark.png");
console.log("Wrote assets/");
