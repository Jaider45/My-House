"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { formatearCOP } from "@/lib/dinero";
import { hoy, sumarDias } from "@/lib/fechas";
import { IaNoConfigurada, leerComprobante, type Archivo } from "@/lib/ia";
import type { Database } from "@/lib/supabase/database.types";
import { decidir, patronDe, type Decision, type ReglaComercio } from "@/lib/comprobantes";

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

const MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_ARCHIVOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

function refrescar() {
  revalidatePath("/comprobantes");
  revalidatePath("/movimientos");
  revalidatePath("/");
}

/** Catálogos que la lectura y la decisión necesitan, en una sola ida a la base. */
async function catalogos(ctx: Ctx) {
  const [{ data: categorias }, { data: cuentas }, { data: etiquetas }, { data: reglas }] = await Promise.all([
    ctx.supabase.from("categories").select("id, nombre").eq("archivada", false),
    ctx.supabase.from("accounts").select("id, nombre, tipo").eq("archivada", false).order("created_at"),
    ctx.supabase.from("tax_tags").select("id, nombre").eq("pais", ctx.hogar.pais),
    ctx.supabase.from("merchant_rules").select("patron, category_id, ambito, activa"),
  ]);
  return {
    categorias: categorias ?? [],
    cuentas: cuentas ?? [],
    etiquetas: etiquetas ?? [],
    reglas: (reglas ?? []) as ReglaComercio[],
  };
}

/** Movimiento existente que ya representa este pago (mismo tipo y monto a ±2 días). */
async function duplicado(ctx: Ctx, d: { tipo: string; monto: number; fecha: string }) {
  const { data } = await ctx.supabase
    .from("transactions")
    .select("id, comercio, fecha")
    .eq("tipo", d.tipo as "gasto" | "ingreso")
    .eq("monto", d.monto)
    .gte("fecha", sumarDias(d.fecha, -2))
    .lte("fecha", sumarDias(d.fecha, 2))
    .limit(1)
    .maybeSingle();
  return data;
}

async function registrar(ctx: Ctx, d: Extract<Decision, { accion: "registrar" | "revisar" }>, archivoPath: string | null) {
  const { data, error } = await ctx.supabase
    .from("transactions")
    .insert({
      household_id: ctx.hogar.id,
      account_id: d.account_id!,
      fecha: d.fecha!,
      monto: d.monto!,
      tipo: d.tipo,
      category_id: d.category_id,
      comercio: d.comercio,
      tax_tag_id: d.tax_tag_id,
      ambito: d.ambito,
      member_id: ctx.miembro.id,
      origen: "ocr",
    })
    .select("id")
    .single();
  if (error) throw new Error(mensajeError(error));
  if (archivoPath) await ctx.supabase.from("attachments").insert({ household_id: ctx.hogar.id, transaction_id: data.id, archivo_path: archivoPath, tipo: "factura" });
  return data.id;
}

/** Sube el archivo a Storage. Si Storage no responde, el comprobante se procesa igual, sin copia guardada. */
async function guardarArchivo(ctx: Ctx, id: string, archivo: File): Promise<string | null> {
  const extension = archivo.type === "application/pdf" ? "pdf" : (archivo.type.split("/")[1] ?? "jpg");
  const ruta = `${ctx.hogar.id}/comprobantes/${id}.${extension}`;
  const { error } = await ctx.supabase.storage.from("soportes").upload(ruta, archivo, { contentType: archivo.type, upsert: true });
  return error ? null : ruta;
}

type Resultado = { id: string; resumen: string; registrado?: number };

/** Lee un comprobante (archivo o texto), decide y lo registra, adjunta o deja por revisar. */
async function procesar(ctx: Ctx, cat: Awaited<ReturnType<typeof catalogos>>, entrada: { archivo?: File; texto?: string }): Promise<Resultado> {
  const fecha = hoy();
  const { data: recibo, error } = await ctx.supabase
    .from("receipts")
    .insert({ household_id: ctx.hogar.id, nombre_archivo: entrada.archivo?.name ?? null, mime: entrada.archivo?.type ?? "text/plain" })
    .select("id")
    .single();
  if (error) throw new Error(mensajeError(error));

  const actualizar = (cambios: Database["public"]["Tables"]["receipts"]["Update"]) => ctx.supabase.from("receipts").update(cambios).eq("id", recibo.id);
  try {
    const [archivoPath, lectura] = await Promise.all([
      entrada.archivo ? guardarArchivo(ctx, recibo.id, entrada.archivo) : Promise.resolve(null),
      leerComprobante(
        {
          archivo: entrada.archivo
            ? ({ mime: entrada.archivo.type, nombre: entrada.archivo.name, base64: Buffer.from(await entrada.archivo.arrayBuffer()).toString("base64") } satisfies Archivo)
            : undefined,
          texto: entrada.texto,
        },
        { hoy: fecha, categorias: cat.categorias.map((c) => c.nombre), cuentas: cat.cuentas.map((c) => c.nombre), etiquetas: cat.etiquetas.map((e) => e.nombre) },
      ),
    ]);
    const cuentaPorDefecto = cat.cuentas.find((c) => c.tipo !== "tarjeta")?.id ?? cat.cuentas[0]?.id ?? null;
    const d = decidir(lectura, { ...cat, hoy: fecha, cuentaPorDefecto });
    const datos = { ...lectura, confianza: lectura.confianza };

    if (d.accion === "descartar") {
      await actualizar({ archivo_path: archivoPath, estado: "descartado", datos, pregunta: d.motivo });
      return { id: recibo.id, resumen: d.motivo };
    }
    if (d.accion === "registrar") {
      const existente = await duplicado(ctx, { tipo: d.tipo, monto: d.monto!, fecha: d.fecha! });
      if (existente) {
        if (archivoPath) await ctx.supabase.from("attachments").insert({ household_id: ctx.hogar.id, transaction_id: existente.id, archivo_path: archivoPath, tipo: "factura" });
        await actualizar({ archivo_path: archivoPath, estado: "soporte", datos, transaction_id: existente.id });
        return { id: recibo.id, resumen: `${d.comercio} ya estaba registrado (${existente.comercio ?? "movimiento"} del ${existente.fecha}): no lo dupliqué, lo adjunté como soporte.` };
      }
      if (!d.account_id) {
        await actualizar({ archivo_path: archivoPath, estado: "por_revisar", datos, pregunta: "Crea una cuenta para poder registrarlo." });
        return { id: recibo.id, resumen: "Necesito que crees una cuenta antes de registrar comprobantes." };
      }
      const transaccion = await registrar(ctx, d, archivoPath);
      await actualizar({ archivo_path: archivoPath, estado: "registrado", datos, transaction_id: transaccion });
      return { id: recibo.id, resumen: `${d.comercio}: ${formatearCOP(d.monto!)} registrado.`, registrado: d.monto! };
    }
    await actualizar({ archivo_path: archivoPath, estado: "por_revisar", datos, pregunta: d.pregunta });
    return { id: recibo.id, resumen: `${d.comercio || "Un comprobante"}: ${d.pregunta}` };
  } catch (e) {
    const texto = e instanceof Error ? e.message : "No pude leer el comprobante.";
    await actualizar({ estado: "error", pregunta: texto });
    if (e instanceof IaNoConfigurada) throw e;
    return { id: recibo.id, resumen: texto };
  }
}

/** Mensaje de la familia con fotos, PDF o texto: se leen en paralelo y el asistente responde con el resumen. */
export async function enviarAlAsistente(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const texto = String(datos.get("texto") ?? "").trim().slice(0, 1000);
  const archivos = datos.getAll("archivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (!texto && !archivos.length) return { error: "Escribe un mensaje o adjunta un comprobante." };
  if (archivos.length > MAX_ARCHIVOS) return { error: `Máximo ${MAX_ARCHIVOS} archivos por mensaje.` };
  const malo = archivos.find((a) => !MIMES.includes(a.type) || a.size > MAX_BYTES);
  if (malo) return { error: `${malo.name}: solo fotos (JPG, PNG, WebP) o PDF de hasta 10 MB.` };
  if (!process.env.ANTHROPIC_API_KEY) return { error: new IaNoConfigurada().message };

  const cat = await catalogos(ctx);
  const { data: mensaje } = await ctx.supabase
    .from("assistant_messages")
    .insert({ household_id: ctx.hogar.id, autor: "usuario", texto: texto || (archivos.length === 1 ? "Te mando este comprobante" : `Te mando ${archivos.length} comprobantes`) })
    .select("id")
    .single();

  try {
    const entradas = archivos.length ? archivos.map((archivo) => ({ archivo, texto: texto || undefined })) : [{ texto }];
    const resultados = await Promise.all(entradas.map((e) => procesar(ctx, cat, e)));
    const ids = resultados.map((r) => r.id);
    if (mensaje) await ctx.supabase.from("assistant_messages").update({ receipt_ids: ids }).eq("id", mensaje.id);

    const registrados = resultados.filter((r) => r.registrado);
    const total = registrados.reduce((s, r) => s + (r.registrado ?? 0), 0);
    const encabezado = registrados.length
      ? `Registré ${registrados.length} ${registrados.length === 1 ? "movimiento" : "movimientos"} por ${formatearCOP(total)}.`
      : resultados.length > 1
        ? `Leí los ${resultados.length} comprobantes.`
        : "";
    await ctx.supabase.from("assistant_messages").insert({
      household_id: ctx.hogar.id,
      autor: "asistente",
      texto: [encabezado, ...resultados.map((r) => r.resumen)].filter(Boolean).join("\n"),
      receipt_ids: ids,
    });
    refrescar();
    return { ok: encabezado || "Listo." };
  } catch (e) {
    refrescar();
    return { error: e instanceof Error ? e.message : "No pude procesar el mensaje." };
  }
}

const esquemaResolver = z.object({
  id: z.uuid(),
  category_id: z.uuid("Elige la categoría."),
  monto: z.coerce.number().int().positive("Escribe el total."),
  fecha: z.iso.date("Escribe la fecha."),
  ambito: z.enum(["personal", "negocio"]),
  account_id: z.uuid("Elige la cuenta."),
  aprender: z.literal("on").optional(),
});

/** Completa un comprobante por revisar, lo registra y, si se pide, aprende la regla del comercio. */
export async function resolverComprobante(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaResolver.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const { data: recibo } = await ctx.supabase.from("receipts").select("id, datos, archivo_path, estado").eq("id", r.data.id).single();
  if (!recibo || recibo.estado === "registrado") return { error: "Ese comprobante ya no está pendiente." };
  const leido = (recibo.datos ?? {}) as { comercio?: string; tipo?: "gasto" | "ingreso"; etiqueta_dian?: string | null };
  const comercio = leido.comercio || "Comprobante";

  try {
    const transaccion = await registrar(
      ctx,
      {
        accion: "registrar",
        pregunta: null,
        tipo: leido.tipo ?? "gasto",
        comercio,
        fecha: r.data.fecha,
        monto: r.data.monto,
        category_id: r.data.category_id,
        account_id: r.data.account_id,
        tax_tag_id: null,
        ambito: r.data.ambito,
        porRegla: false,
      },
      recibo.archivo_path,
    );
    await ctx.supabase.from("receipts").update({ estado: "registrado", transaction_id: transaccion, pregunta: null }).eq("id", recibo.id);
    const patron = patronDe(comercio);
    if (r.data.aprender && patron.length >= 2) {
      await ctx.supabase
        .from("merchant_rules")
        .upsert({ household_id: ctx.hogar.id, patron, category_id: r.data.category_id, ambito: r.data.ambito, activa: true }, { onConflict: "household_id,patron" });
    }
    await ctx.supabase.from("assistant_messages").insert({
      household_id: ctx.hogar.id,
      autor: "asistente",
      texto: `Listo. Registré ${comercio} por ${formatearCOP(r.data.monto)}.${r.data.aprender && patron ? ` Desde ahora, lo de «${patron}» irá a esa categoría sin preguntarte.` : ""}`,
      receipt_ids: [recibo.id],
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No pude registrarlo." };
  }
  refrescar();
  return { ok: "Registrado." };
}

/** Deshace un comprobante registrado: borra el movimiento que creó (no toca movimientos a los que solo se adjuntó). */
export async function deshacerComprobante(datos: FormData) {
  const ctx = await obtenerContexto();
  const { data: recibo } = await ctx.supabase.from("receipts").select("id, estado, transaction_id").eq("id", String(datos.get("id"))).single();
  if (!recibo) return;
  if (recibo.estado === "registrado" && recibo.transaction_id) await ctx.supabase.from("transactions").delete().eq("id", recibo.transaction_id);
  await ctx.supabase.from("receipts").update({ estado: "descartado", transaction_id: null }).eq("id", recibo.id);
  refrescar();
}

export async function cambiarRegla(datos: FormData) {
  const ctx = await obtenerContexto();
  await ctx.supabase.from("merchant_rules").update({ activa: datos.get("activa") === "1" }).eq("id", String(datos.get("id")));
  revalidatePath("/comprobantes");
}
