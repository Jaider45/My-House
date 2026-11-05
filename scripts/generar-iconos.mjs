// Genera los íconos de la PWA con el ícono de app del sistema de diseño. Uso: node scripts/generar-iconos.mjs
// (Node 24 importa el .ts directamente: solo tiene datos.)
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { TRAZOS } from "../src/components/marca-datos.ts";

const isotipo = (escala) => {
  const lado = 256 * escala;
  const borde = (1024 - lado) / 2;
  return `<g transform="translate(${borde} ${borde}) scale(${escala})">
    <path d="${TRAZOS.Q1}" fill="#faf5ee"/><path d="${TRAZOS.Q2}" fill="#e0643c"/></g>`;
};

// Normal: esquinas al 22 %. Maskable: fondo completo y el dibujo dentro de la zona segura (80 %).
const normal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="225" fill="#143d33"/>${isotipo(2.48)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#143d33"/>${isotipo(2.1)}</svg>`;

await writeFile("public/iconos/icono.svg", normal);
await writeFile("src/app/icon.svg", normal);
const salidas = [
  [normal, 192, "public/iconos/icono-192.png"],
  [normal, 512, "public/iconos/icono-512.png"],
  [maskable, 512, "public/iconos/icono-maskable-512.png"],
  [maskable, 180, "public/iconos/apple-touch-icon.png"],
  [maskable, 180, "src/app/apple-icon.png"],
];
for (const [svg, tam, ruta] of salidas) {
  await sharp(Buffer.from(svg)).resize(tam, tam).png().toFile(ruta);
}
console.log("Íconos generados en public/iconos y src/app");
