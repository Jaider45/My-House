"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { crearPlantillaMeta, listarPlantillasMeta } from "@/lib/integraciones/servidor";
import { cuerpoMeta, estadoDeMeta, revisar, type Boton, type Categoria, type Plantilla } from "@/lib/whatsapp/plantillas";

const SIN_PERMISO = "Solo el rol Contenido o un superadmin editan plantillas de WhatsApp.";

function leer(d: FormData): Plantilla & { id: string } {
  let botones: Boton[] = [];
  try {
    botones = (JSON.parse(String(d.get("botones") ?? "[]")) as Boton[]).slice(0, 3);
  } catch {
    botones = [];
  }
  return {
    id: String(d.get("id") ?? ""),
    nombre: String(d.get("nombre") ?? "").trim(),
    idioma: String(d.get("idioma") ?? "es"),
    categoria: (String(d.get("categoria") ?? "UTILITY") as Categoria),
    encabezado: String(d.get("encabezado") ?? "").trim(),
    cuerpo: String(d.get("cuerpo") ?? ""),
    ejemplos: d.getAll("ejemplo").map((x) => String(x).trim()),
    pie: String(d.get("pie") ?? "").trim(),
    botones: botones.map((b) => ({ tipo: b.tipo === "URL" ? "URL" : "QUICK_REPLY", texto: String(b.texto ?? "").trim(), ...(b.tipo === "URL" && { url: String(b.url ?? "").trim() }) })),
  };
}

async function guardar(p: Plantilla & { id: string }) {
  const staff = await obtenerStaff();
  if (!staff.puede("contenido_app")) return { staff, error: SIN_PERMISO };
  if (!/^[a-z][a-z0-9_]{0,100}$/.test(p.nombre)) return { staff, error: "El nombre va en minúsculas, con guion bajo y sin espacios (ej.: recordatorio_pago)." };
  const { data, error } = await staff.supabase.rpc("consola_guardar_plantilla", { p: p as never });
  if (error) return { staff, error: mensajeError(error) };
  return { staff, id: data as string };
}

/** «Guardar borrador» o «Enviar a revisión de Meta» (el botón que se tocó decide). */
export async function accionPlantilla(_: Estado, d: FormData): Promise<Estado> {
  const p = leer(d);
  const enviar = d.get("operacion") === "meta";
  if (enviar) {
    const r = revisar(p);
    if (r.errores.length) return { error: r.errores[0] };
  }
  const g = await guardar(p);
  if ("error" in g && g.error) return { error: g.error };
  const id = (g as { id: string }).id;
  if (enviar) {
    const m = await crearPlantillaMeta(cuerpoMeta(p));
    if (!m.ok) {
      revalidatePath("/consola/whatsapp");
      return { error: `Quedó guardada, pero Meta no la recibió: ${m.detalle}` };
    }
    const { error } = await g.staff.supabase.rpc("consola_plantilla_enviada", { p_id: id, p_meta_id: m.id, p_estado: estadoDeMeta(m.status) });
    if (error) return { error: mensajeError(error) };
  }
  revalidatePath("/consola/whatsapp");
  if (!p.id) redirect(`/consola/whatsapp?id=${id}`);
  return { ok: enviar ? "Enviada a Meta. Suele tardar menos de un día; el estado cambia solo." : "Borrador guardado." };
}

/** Trae de Meta el estado de todas las plantillas de la cuenta. */
export async function sincronizar(): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("contenido_app")) return { error: SIN_PERMISO };
  const r = await listarPlantillasMeta();
  if (!r.ok) return { error: r.detalle };
  for (const t of r.plantillas) {
    await staff.supabase.rpc("consola_plantilla_estado_meta", { p_nombre: t.name, p_idioma: t.language, p_estado: estadoDeMeta(t.status), p_motivo: t.rejected_reason ?? "", p_meta_id: t.id });
  }
  revalidatePath("/consola/whatsapp");
  return { ok: `Listo: ${r.plantillas.length} ${r.plantillas.length === 1 ? "plantilla" : "plantillas"} en Meta.` };
}

/** Una plantilla enviada no se edita: se copia con otro nombre como borrador. */
export async function duplicar(_: Estado, d: FormData): Promise<Estado> {
  const p = leer(d);
  const g = await guardar({ ...p, id: "", nombre: `${p.nombre}_v2`.slice(0, 100) });
  if ("error" in g && g.error) return { error: g.error };
  revalidatePath("/consola/whatsapp");
  redirect(`/consola/whatsapp?id=${(g as { id: string }).id}`);
}
