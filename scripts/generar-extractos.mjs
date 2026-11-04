// Genera extractos CSV de ejemplo (formato tipo banco colombiano, Windows-1252) para probar la importación.
// Uso: node scripts/generar-extractos.mjs
import { writeFile } from "node:fs/promises";

const comercios = [
  ["COMPRA EN ÉXITO LAURELES", -185400], ["PAGO PSE EPM SERVICIOS", -312900], ["COMPRA D1 TIENDA", -45900],
  ["GASOLINA TERPEL", -120000], ["DROGUERÍA ALEMANA", -38500], ["RESTAURANTE EL CIELO", -96000],
  ["UBER TRIP", -18700], ["NETFLIX.COM", -38900], ["PAGO COLEGIO SAN JOSÉ", -950000],
];
const pesos = (n) => {
  const [e, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${e.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
};

function extracto(desde, hasta) {
  const lineas = ["BANCO DE EJEMPLO S.A.;;;", "Cuenta de ahorros ****1234;;;", "FECHA;DESCRIPCIÓN;REFERENCIA;VALOR"];
  for (let d = new Date(`${desde}T00:00:00Z`); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
    const [a, m, dia] = d.toISOString().slice(0, 10).split("-");
    const fecha = `${dia}/${m}/${a}`;
    const n = Number(dia);
    if (n === 1) lineas.push(`${fecha};ABONO NÓMINA EMPRESA XYZ;N${m};${pesos(4800000)}`);
    if (n % 3 === 0) {
      const [c, v] = comercios[(n / 3) % comercios.length];
      lineas.push(`${fecha};${c};R${m}${dia};${pesos(v)}`);
    }
    if (n === 15) {
      lineas.push(`${fecha};COMPRA D1 TIENDA;R${m}15A;${pesos(-12900)}`);
      lineas.push(`${fecha};COMPRA D1 TIENDA;R${m}15B;${pesos(-12900)}`);
    }
  }
  return Buffer.from(lineas.join("\r\n") + "\r\n", "latin1");
}

await writeFile("docs/ejemplos/extracto-ago-oct-2026.csv", extracto("2026-08-01", "2026-10-31"));
await writeFile("docs/ejemplos/extracto-oct-nov-2026.csv", extracto("2026-10-01", "2026-11-03"));
console.log("Extractos de ejemplo en docs/ejemplos/");
