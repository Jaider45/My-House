"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { idDe, mensajeError, NO_ENCONTRADO, SOLO_LECTURA, type Estado } from "@/lib/acciones";
import { clasificar, huellas, normalizarDescripcion, type Clasificacion, type FilaLeida } from "@/lib/importacion";
import { validarMovimiento } from "@/lib/ingesta";
import { hoy, sumarDias } from "@/lib/fechas";
import { IaNoConfigurada, iaDelHogar, leerExtracto, type UsoIa } from "@/lib/ia";
import { registrarUsos } from "@/lib/ia/uso";
import { registrarError } from "@/lib/registro-tecnico";

const MAX_FILAS = 5000;

const fila = z.object({
  fila: z.number().int(),
  fecha: z.iso.date(),
  monto: z.number().int().positive(),
  tipo: z.enum(["ingreso", "gasto"]),
  descripcion: z.string().max(200),
});

const mapeo = z.object({
  fecha: z.string(),
  descripcion: z.string(),
  modo: z.enum(["unico", "separado"]),
  monto: z.string().optional(),
  debito: z.string().optional(),
  credito: z.string().optional(),
  gastosNegativos: z.boolean(),
});

export type Analisis = { error?: string; estados?: Clasificacion[]; sugerencias?: (string | null)[] };

/** Clasifica cada fila (nuevo / duplicado / posible) y sugiere categoría por comercios ya categorizados. */
export async function analizarImportacion(entrada: { cuentaId: string; filas: FilaLeida[] }): Promise<Analisis> {
  const r = z.object({ cuentaId: z.uuid(), filas: z.array(fila).min(1).max(MAX_FILAS) }).safeParse(entrada);
  if (!r.success) return { error: "El archivo no tiene filas válidas." };
  const { cuentaId, filas } = r.data;
  const ctx = await obtenerContexto();

  const fechas = filas.map((f) => f.fecha).sort();
  const [existentes, historial, hashes] = await Promise.all([
    ctx.supabase
      .from("transactions")
      .select("fecha, monto, tipo, import_hash, origen")
      .eq("account_id", cuentaId)
      .gte("fecha", sumarDias(fechas[0], -2))
      .lte("fecha", sumarDias(fechas[fechas.length - 1], 2))
      .limit(20_000),
    ctx.supabase
      .from("transactions")
      .select("comercio, category_id")
      .not("comercio", "is", null)
      .not("category_id", "is", null)
      .order("fecha", { ascending: false })
      .limit(3000),
    huellas(cuentaId, filas),
  ]);
  if (existentes.error) return { error: mensajeError(existentes.error) };

  const categoriaPorComercio = new Map<string, string>();
  for (const h of historial.data ?? []) {
    const clave = normalizarDescripcion(h.comercio!);
    if (!categoriaPorComercio.has(clave)) categoriaPorComercio.set(clave, h.category_id!);
  }

  return {
    estados: clasificar(filas, hashes, existentes.data),
    sugerencias: filas.map((f) => categoriaPorComercio.get(normalizarDescripcion(f.descripcion)) ?? null),
  };
}

export type Resultado = { error?: string; importadas?: number; duplicadas?: number };

/**
 * Importa las filas marcadas. Recibe TODAS las filas del archivo para calcular las huellas igual que en el
 * análisis (la huella depende de las repeticiones dentro del archivo). El índice único (cuenta, huella) es la
 * última barrera contra duplicados.
 */
export async function importarMovimientos(entrada: {
  cuentaId: string;
  archivo: string;
  mapeo: z.infer<typeof mapeo>;
  filas: (FilaLeida & { incluir: boolean; category_id: string | null })[];
}): Promise<Resultado> {
  const r = z
    .object({
      cuentaId: z.uuid(),
      archivo: z.string().trim().min(1).max(200),
      mapeo,
      filas: z.array(fila.extend({ incluir: z.boolean(), category_id: z.uuid().nullable() })).min(1).max(MAX_FILAS),
    })
    .safeParse(entrada);
  if (!r.success) return { error: "Datos de importación inválidos." };
  const { cuentaId, archivo, filas } = r.data;
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };

  const hashes = await huellas(cuentaId, filas);
  const elegidas = filas.map((f, i) => ({ f, hash: hashes[i] })).filter(({ f }) => f.incluir);
  if (!elegidas.length) return { error: "No marcó ninguna fila para importar." };

  const { data: lote, error: eLote } = await ctx.supabase
    .from("import_batches")
    .insert({ household_id: ctx.hogar.id, account_id: cuentaId, archivo_nombre: archivo, filas_total: filas.length, filas_importadas: 0, filas_duplicadas: 0 })
    .select("id")
    .single();
  if (eLote) return { error: mensajeError(eLote) };

  const registros = [];
  for (const { f, hash } of elegidas) {
    const v = validarMovimiento({
      tipo: f.tipo,
      fecha: f.fecha,
      monto: f.monto,
      account_id: cuentaId,
      category_id: f.category_id,
      comercio: f.descripcion,
      origen: "importacion",
    });
    if (!v.ok) return { error: `Fila ${f.fila}: ${v.error}` };
    registros.push({ ...v.movimiento, household_id: ctx.hogar.id, import_batch_id: lote.id, import_hash: hash });
  }

  const { data: insertadas, error } = await ctx.supabase
    .from("transactions")
    .upsert(registros, { onConflict: "account_id,import_hash", ignoreDuplicates: true })
    .select("id");
  if (error) {
    await ctx.supabase.from("import_batches").delete().eq("id", lote.id);
    return { error: mensajeError(error) };
  }
  const importadas = insertadas?.length ?? 0;
  const duplicadas = filas.length - importadas;
  await Promise.all([
    ctx.supabase.from("import_batches").update({ filas_importadas: importadas, filas_duplicadas: duplicadas }).eq("id", lote.id),
    ctx.supabase.from("accounts").update({ mapeo_csv: r.data.mapeo }).eq("id", cuentaId),
  ]);
  if (!importadas) await ctx.supabase.from("import_batches").delete().eq("id", lote.id);

  revalidatePath("/importar");
  revalidatePath("/movimientos");
  revalidatePath("/");
  return { importadas, duplicadas };
}

export async function deshacerLote(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  const id = idDe(datos);
  if (!id) return { error: NO_ENCONTRADO };
  // Borrar el lote borra en cascada sus movimientos.
  const { data, error } = await ctx.supabase.from("import_batches").delete().eq("id", id).select("id");
  if (error) return { error: mensajeError(error) };
  if (!data.length) return { error: NO_ENCONTRADO };
  revalidatePath("/importar");
  revalidatePath("/movimientos");
  revalidatePath("/");
  return { ok: "Importación deshecha." };
}

/**
 * Lee un extracto en PDF con el modelo y devuelve sus filas (fecha, descripción, valor con signo) para que el
 * importador las trate igual que un CSV: mismo mapeo, mismas huellas y la misma detección de duplicados.
 */
export async function leerExtractoPdf(datos: FormData): Promise<{ filas?: { fecha: string; descripcion: string; valor: number }[]; banco?: string | null; error?: string }> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.type !== "application/pdf") return { error: "Elige un archivo PDF." };
  if (archivo.size > 20 * 1024 * 1024) return { error: "El PDF pesa más de 20 MB: divídelo por meses." };
  // El cupo de IA se reserva en paralelo con la lectura del archivo y la configuración del hogar.
  const [ia, cupo, base64] = await Promise.all([
    iaDelHogar(ctx),
    ctx.supabase.rpc("reservar_uso_ia", { p_hogar: ctx.hogar.id, p_tipo: "extracto" }),
    archivo.arrayBuffer().then((b) => Buffer.from(b).toString("base64")),
  ]);
  if (!ia) return { error: new IaNoConfigurada().message };
  if (cupo.error) return { error: mensajeError(cupo.error) };
  const usos: UsoIa[] = [];
  const inicio = Date.now();
  try {
    const { banco, filas } = await leerExtracto(ia, { mime: "application/pdf", base64, nombre: archivo.name }, hoy(), (u) => usos.push(u)).finally(() =>
      registrarUsos(ctx, usos, Date.now() - inicio),
    );
    if (!filas.length) return { error: "No encontré movimientos en ese PDF. ¿Es un extracto?" };
    if (filas.length > MAX_FILAS) return { error: `El extracto tiene más de ${MAX_FILAS} movimientos: divídelo.` };
    return { banco, filas };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No pude leer el PDF.";
    await registrarError(ctx, "importacion", mensaje, { archivo: archivo.name.slice(0, 120), bytes: archivo.size, proveedor: ia.proveedor, modelo: ia.modelo });
    return { error: mensaje };
  }
}
