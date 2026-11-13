import "server-only";
import type { obtenerContexto } from "@/lib/sesion";
import { cargarSemaforo } from "./servidor";
import type { DatosReporte, FilaEtiqueta, FilaMovimiento } from "./reporte";

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

export type Soporte = { id: string; ruta: string; tipo: string; fecha: string; concepto: string; etiqueta: string | null };

/**
 * Datos del reporte de renta del hogar (lo usan Renta DIAN, la descarga para Excel y la página imprimible). Los
 * movimientos con etiqueta DIAN del año, a quién se atribuyen (persona del movimiento o titular de la cuenta) y si
 * tienen soporte. Todo con la sesión de quien lo pide: RLS deja ver solo su hogar (el contador ve el de su cliente).
 */
export async function cargarReporte(ctx: Ctx, anio: number): Promise<DatosReporte & { soportes: Soporte[] }> {
  const [semaforo, { data: movs }, { data: miembros }, { data: cuentas }, { data: hogar }] = await Promise.all([
    cargarSemaforo(ctx, anio),
    ctx.supabase
      .from("transactions")
      .select("id, fecha, monto, tipo, comercio, member_id, account_id, tax_tags(nombre), attachments(id, archivo_path, tipo)")
      .eq("household_id", ctx.hogar.id)
      .not("tax_tag_id", "is", null)
      .eq("estado", "confirmado")
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`)
      .order("fecha"),
    ctx.supabase.from("members").select("id, nombre").eq("household_id", ctx.hogar.id),
    ctx.supabase.from("accounts").select("id, titular_member_id").eq("household_id", ctx.hogar.id),
    ctx.supabase.from("households").select("nombre").eq("id", ctx.hogar.id).single(),
  ]);
  const nombre = new Map((miembros ?? []).map((m) => [m.id, m.nombre]));
  const titular = new Map((cuentas ?? []).map((c) => [c.id, c.titular_member_id]));

  const movimientos: FilaMovimiento[] = [];
  const soportes: Soporte[] = [];
  const porEtiqueta = new Map<string, FilaEtiqueta>();
  for (const m of movs ?? []) {
    const etiqueta = m.tax_tags?.nombre ?? "Otra";
    const adjuntos = m.attachments ?? [];
    const persona = m.member_id ?? titular.get(m.account_id) ?? null;
    movimientos.push({ fecha: m.fecha, persona: persona ? (nombre.get(persona) ?? null) : null, concepto: m.comercio ?? "", etiqueta, tipo: m.tipo, monto: m.monto, soporte: adjuntos.length > 0 });
    const e = porEtiqueta.get(etiqueta) ?? { etiqueta, movimientos: 0, total: 0, conSoporte: 0 };
    porEtiqueta.set(etiqueta, { ...e, movimientos: e.movimientos + 1, total: e.total + m.monto, conSoporte: e.conSoporte + (adjuntos.length ? 1 : 0) });
    for (const a of adjuntos) soportes.push({ id: a.id, ruta: a.archivo_path, tipo: a.tipo, fecha: m.fecha, concepto: m.comercio ?? etiqueta, etiqueta });
  }

  return {
    hogar: hogar?.nombre ?? ctx.hogar.nombre,
    anio,
    generado: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()),
    unidad: semaforo.ok ? semaforo.jurisdiccion.unidad : "UVT",
    valorUnidad: semaforo.ok ? semaforo.params.uvt_valor : null,
    topes: semaforo.ok
      ? semaforo.personas.flatMap((p) => p.topes.map((t) => ({ persona: p.nombre, tope: t.nombre, acumulado: t.acumulado, topePesos: t.tope, porcentaje: t.porcentaje, estado: t.semaforo })))
      : [],
    etiquetas: [...porEtiqueta.values()].sort((a, b) => b.total - a.total),
    movimientos,
    soportes,
  };
}
