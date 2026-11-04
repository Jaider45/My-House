// Genera los íconos de la PWA desde un SVG. Uso: node scripts/generar-iconos.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const casa = (escala) => `
  <g transform="translate(256 256) scale(${escala}) translate(-256 -256)" fill="none" stroke="#fff"
     stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
    <path d="M112 236 256 120l144 116"/>
    <path d="M148 212v168h216V212"/>
    <path d="M226 380v-84h60v84" fill="#fff"/>
  </g>`;

// Normal: esquinas redondeadas. Maskable: fondo completo y dibujo dentro de la zona segura (80 %).
const normal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0f766e"/>${casa(1)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f766e"/>${casa(0.78)}</svg>`;

await writeFile("public/iconos/icono.svg", normal);
const salidas = [
  [normal, 192, "icono-192.png"],
  [normal, 512, "icono-512.png"],
  [maskable, 512, "icono-maskable-512.png"],
  [maskable, 180, "apple-touch-icon.png"],
];
for (const [svg, tam, nombre] of salidas) {
  await sharp(Buffer.from(svg)).resize(tam, tam).png().toFile(`public/iconos/${nombre}`);
}
console.log("Íconos generados en public/iconos");
