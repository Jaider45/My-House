// Imágenes de los correos: los clientes de correo bloquean SVG, así que el logo y los íconos van en PNG al doble de
// resolución (pantallas retina). Uso: node scripts/generar-imagenes-correo.mjs → public/correo/
// Los nombres y tonos deben coincidir con ICONOS_CORREO en src/lib/correo/plantilla.ts.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { ICONOS, TRAZOS } from "../src/components/marca-datos.ts";

const MONTE = "#143d33", TEJA = "#e0643c", ARENA = "#faf5ee";
const TONOS = {
  claro: { fondo: "#eef3f0", tinta: MONTE, acento: TEJA },
  monte: { fondo: MONTE, tinta: ARENA, acento: TEJA },
  error: { fondo: "#fbe3dc", tinta: "#93290f", acento: "#93290f" },
  alerta: { fondo: "#fbf0d5", tinta: "#6f4c00", acento: "#6f4c00" },
};
const USADOS = [
  ["configuracion", "claro"], ["casa", "claro"], ["casa", "monte"], ["familia", "claro"], ["declaracion-renta", "claro"],
  ["calendario", "claro"], ["alertas", "error"], ["resumen", "claro"], ["declaracion-renta", "error"],
  ["alertas", "alerta"], ["documentos", "claro"],
];

await mkdir("public/correo", { recursive: true });

// Logo horizontal a color: 30 px de alto en el correo → 60 px reales.
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 868 256">
  <path d="${TRAZOS.P1}" fill="${MONTE}"/><path d="${TRAZOS.P2}" fill="${TEJA}"/><path d="${TRAZOS.W}" fill="${MONTE}"/></svg>`;
await sharp(Buffer.from(logo)).resize({ height: 60 }).png().toFile("public/correo/logo.png");

// Ícono dentro de su cuadro (56 px, esquinas de 16) → 112 px reales. El ícono mide 28 px.
for (const [nombre, tono] of USADOS) {
  const t = TONOS[tono];
  const trazo = ICONOS[nombre].linea.replaceAll("var(--mh-acento,currentColor)", t.acento);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
    <rect width="56" height="56" rx="16" fill="${t.fondo}"/>
    <g transform="translate(14 14) scale(${28 / 24})" fill="none" stroke="${t.tinta}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${trazo}</g></svg>`;
  await sharp(Buffer.from(svg), { density: 300 }).resize(112, 112).png().toFile(`public/correo/${nombre}-${tono}.png`);
}
console.log(`Imágenes de correo en public/correo (${USADOS.length + 1} archivos)`);
