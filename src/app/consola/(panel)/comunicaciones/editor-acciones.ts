"use server";

import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { problemasCampana, type BloqueCorreo } from "@/lib/correo/bloques";
import { contenidoCampana } from "@/lib/correo/campanas";
import { olvidarConfig } from "@/lib/plataforma/config";
import { AUTOMATICOS } from "@/lib/correo/automaticos";

const SIN_PERMISO = "Solo Contenido o un superadmin manejan campañas.";

export type DatosCampana = {
  id: string | null;
  nombre: string;
  segmento: string;
  segmento_propio: string | null;
  asunto: string;
  asunto_b: string;
  prueba_ab_pct: number;
  vista_previa: string;
  bloques: BloqueCorreo[];
  /** «AAAA-MM-DDTHH:MM» en hora de Bogotá, o vacío = borrador. */
  programada: string;
};

export type EstadoEditor = (NonNullable<Estado> & { id?: string; guardado?: string }) | null;

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("campanas") ? staff : null;
}

/** Guarda el diseño y la audiencia (borrador) o la programa si trae fecha. Devuelve el id para seguir editando. */
export async function guardarEditor(d: DatosCampana, programar: boolean): Promise<EstadoEditor> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  if (programar) {
    const p = problemasCampana(d);
    if (p.length) return { error: p[0] };
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.programada)) return { error: "Elige la fecha y la hora de envío." };
  }
  const { data, error } = await staff.supabase.rpc("consola_guardar_campana_editor", {
    p: {
      id: d.id ?? "",
      nombre: d.nombre.slice(0, 80),
      segmento: d.segmento,
      segmento_propio: d.segmento === "propio" ? (d.segmento_propio ?? "") : "",
      asunto: d.asunto.slice(0, 150),
      asunto_b: d.asunto_b.slice(0, 150),
      prueba_ab_pct: Math.min(50, Math.max(5, d.prueba_ab_pct || 20)),
      vista_previa: d.vista_previa.slice(0, 150),
      bloques: d.bloques.slice(0, 40),
      titulo: "",
      cuerpo: "",
      programada_para: programar ? `${d.programada}:00-05:00` : "",
    } as never,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/comunicaciones");
  const hora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date());
  return { ok: programar ? "Programada. Sale con el envío diario desde esa hora." : "Borrador guardado.", id: data as string, guardado: hora };
}

/** «Enviar prueba»: solo a quien la pide, con los datos de su propio hogar si tiene uno (o de ejemplo). */
export async function enviarPruebaEditor(d: DatosCampana, v: "a" | "b"): Promise<EstadoEditor> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const p = problemasCampana(d);
  if (p.length) return { error: p[0] };
  const contenido = contenidoCampana(
    { id: d.id ?? "prueba", asunto: d.asunto, asunto_b: d.asunto_b || null, prueba_ab_pct: 0, vista_previa: d.vista_previa || null, bloques: d.bloques, titulo: "", cuerpo: "", boton_texto: null, boton_url: null, transaccional: false },
    { nombre: staff.nombre.split(/\s+/)[0], hogar: "Hogar de prueba", minimo: "$ 9.738.933", plan: "Familia", fecha_pago: "4 de diciembre" },
    v,
    sitio(),
  );
  const r = await enviarCorreo({ para: staff.email, etiqueta: "campana-prueba", contenido: { ...contenido, asunto: `[Prueba] ${String(contenido.asunto)}` } });
  return r.enviado ? { ok: `Prueba (asunto ${v.toUpperCase()}) enviada a ${staff.email}.` } : { error: `No salió: ${r.error ?? "revisa la integración de correo"}.` };
}

export async function guardarSegmento(_: Estado, f: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const nombre = String(f.get("nombre") ?? "").trim();
  if (f.get("borrar") !== "1" && nombre.length < 3) return { error: "Ponle nombre al segmento." };
  const { error } = await staff.supabase.rpc("consola_guardar_segmento", {
    p: {
      id: String(f.get("id") ?? ""),
      borrar: f.get("borrar") === "1",
      nombre,
      plan: String(f.get("plan") ?? "todos"),
      actividad: String(f.get("actividad") ?? "cualquiera"),
      condiciones: f.getAll("condiciones").map(String),
    } as never,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/comunicaciones");
  return { ok: f.get("borrar") === "1" ? "Segmento borrado." : "Segmento guardado." };
}

/** Encender o apagar un correo automático (solo los que no son de seguridad ni de cobro). */
export async function cambiarAutomatico(_: Estado, f: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const clave = String(f.get("clave") ?? "");
  if (!AUTOMATICOS.some((a) => a.clave === clave && a.apagable)) return { error: "Ese correo no se puede apagar." };
  const { data } = await staff.supabase.from("plataforma_config").select("valor").eq("clave", "correos_apagados").maybeSingle();
  const actuales = new Set((data?.valor as string[] | null) ?? []);
  if (f.get("activo") === "1") actuales.delete(clave);
  else actuales.add(clave);
  const { error } = await staff.supabase.rpc("consola_guardar_ajuste", { p_clave: "correos_apagados", p_valor: [...actuales] as never });
  if (error) return { error: mensajeError(error) };
  olvidarConfig("correos_apagados");
  revalidatePath("/consola/comunicaciones");
  return { ok: f.get("activo") === "1" ? "Encendido." : "Apagado: deja de salir desde ya." };
}
