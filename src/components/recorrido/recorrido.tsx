import { cargarRecorrido } from "@/lib/recorrido/servidor";
import { BarraRecorrido } from "./barra-recorrido";

/** Barra de la guía en el layout: nada para solo lectura ni si la persona la ocultó (o la cerró al terminar). */
export async function Recorrido() {
  const r = await cargarRecorrido();
  if (!r || r.oculto) return null;
  return <BarraRecorrido resueltos={r.resueltos} total={r.total} porcentaje={r.porcentaje} siguiente={r.siguiente} />;
}
