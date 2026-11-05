import type { NombreIcono } from "@/components/marca";

/** Palabra clave (sin tildes, minúscula) → ícono del sistema. La primera coincidencia gana. */
const REGLAS: [string, NombreIcono][] = [
  ["vivienda", "arriendo"],
  ["arriendo", "arriendo"],
  ["administracion", "casa"],
  ["servicio", "servicios"],
  ["internet", "conectividad"],
  ["celular", "conectividad"],
  ["conectividad", "conectividad"],
  ["mercado", "mercado"],
  ["transporte", "transporte"],
  ["gasolina", "transporte"],
  ["educacion", "educacion"],
  ["colegio", "educacion"],
  ["salud", "salud"],
  ["seguro", "documentos"],
  ["deuda", "egresos"],
  ["credito", "egresos"],
  ["entretenimiento", "entretenimiento"],
  ["restaurante", "entretenimiento"],
  ["mascota", "mascotas"],
  ["imprevisto", "alertas"],
  ["ahorro", "ahorro"],
  ["rendimiento", "ahorro"],
  ["honorario", "documentos"],
  ["salario", "ingresos"],
  ["hogar", "casa"],
  ["ropa", "casa"],
];

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Ícono para una categoría según su nombre (o el de su raíz); si nada coincide, el de su clase. */
export function iconoCategoria(nombre: string | null | undefined, clase: "gasto" | "ingreso" = "gasto"): NombreIcono {
  const n = sinTildes(nombre ?? "");
  return REGLAS.find(([clave]) => n.includes(clave))?.[1] ?? (clase === "ingreso" ? "ingresos" : "egresos");
}
