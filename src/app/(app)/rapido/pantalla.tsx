import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { hoy, sumarDias } from "@/lib/fechas";
import { iaDelHogar } from "@/lib/ia";
import { VentanaRegistrar } from "./registrar";
import type { Sugerencia } from "./registro-rapido";

/** Categorías ordenadas por uso en los últimos 90 días. */
function masUsadas(filas: { category_id: string | null }[]): string[] {
  const conteo = new Map<string, number>();
  for (const f of filas) if (f.category_id) conteo.set(f.category_id, (conteo.get(f.category_id) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Conceptos recientes sin repetir (el más reciente manda): de ahí sale la categoría y la cuenta sugeridas. */
function conceptos(filas: { comercio: string | null; tipo: string; category_id: string | null; account_id: string }[]): Sugerencia[] {
  const vistos = new Set<string>();
  const lista: Sugerencia[] = [];
  for (const f of filas) {
    const texto = f.comercio?.trim();
    if (!texto || !f.category_id || (f.tipo !== "gasto" && f.tipo !== "ingreso")) continue;
    const clave = `${f.tipo}:${texto.toLowerCase()}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push({ texto, tipo: f.tipo, category_id: f.category_id, account_id: f.account_id });
    if (lista.length >= 150) break;
  }
  return lista;
}

/** Registrar movimiento: la ventana con sus datos (la usan la ruta /rapido y su versión interceptada). */
export async function PantallaRegistrar({ sobrePantalla }: { sobrePantalla: boolean }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  if (!ctx.puedeRegistrar) return <VentanaRegistrar datos={null} iaLista={false} sobrePantalla={sobrePantalla} />;
  // Familiar: solo gastos escritos a mano (el asistente y los ingresos son de quienes editan).
  const familiar = !ctx.puedeEditar;
  const fecha = hoy();
  const [catalogos, { data: recientes }, ia] = await Promise.all([
    cargarCatalogos(ctx),
    ctx.supabase
      .from("transactions")
      .select("category_id, comercio, tipo, account_id")
      .gte("fecha", sumarDias(fecha, -90))
      .not("category_id", "is", null)
      .neq("origen", "recurrente")
      .order("fecha", { ascending: false })
      .limit(2000),
    familiar ? Promise.resolve(null) : iaDelHogar(ctx),
  ]);
  return (
    <VentanaRegistrar
      datos={{ cuentas: catalogos.cuentas, categorias: catalogos.categorias, frecuentes: masUsadas(recientes ?? []), sugerencias: conceptos(recientes ?? []), hoy: fecha, soloGasto: familiar }}
      sinCuentas={!catalogos.cuentas.length}
      iaLista={ia !== null}
      sobrePantalla={sobrePantalla}
    />
  );
}
