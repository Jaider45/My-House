"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { idDe, mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { correoRevisionLegal } from "@/lib/correo/correos";
import { formatearFechaLarga } from "@/lib/fechas";

const SIN_PERMISO = "Solo el rol Contenido o un superadmin editan los documentos legales.";

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("contenido_app") ? staff : null;
}

const refrescar = () => {
  revalidatePath("/consola/legal");
  revalidatePath("/consola", "layout");
};

export async function nuevoDocumento(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const nombre = String(datos.get("nombre") ?? "").trim();
  if (nombre.length < 3) return { error: "Escribe el nombre del documento." };
  const clave = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(clave)) return { error: "El nombre debe empezar con una letra." };
  const { error } = await staff.supabase.rpc("consola_nuevo_documento", { p_clave: clave, p_nombre: nombre });
  if (error) return { error: mensajeError(error) };
  refrescar();
  redirect(`/consola/legal?doc=${clave}`);
}

export async function nuevaVersion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const doc = String(datos.get("doc") ?? "");
  const { error } = await staff.supabase.rpc("consola_nueva_version", { p_doc: doc, p_mayor: datos.get("mayor") === "1" });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Borrador creado con el texto vigente." };
}

function leerVersion(datos: FormData) {
  const vigente = String(datos.get("vigente_desde") ?? "");
  return {
    p_id: idDe(datos),
    p_contenido: String(datos.get("contenido") ?? "").slice(0, 100_000),
    p_resumen: String(datos.get("resumen") ?? "").slice(0, 600),
    p_vigente: /^\d{4}-\d{2}-\d{2}$/.test(vigente) ? vigente : null,
    p_pedir: datos.get("pedir_aceptacion") === "1",
    p_avisar: datos.get("avisar_correo") === "1",
  };
}

export async function guardarVersion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const v = leerVersion(datos);
  if (!v.p_id) return { error: "Recarga la página e intenta de nuevo." };
  const { error } = await staff.supabase.rpc("consola_guardar_version", { ...v, p_id: v.p_id, p_vigente: v.p_vigente as string });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Borrador guardado." };
}

/** Guarda lo escrito y manda al abogado un enlace personal (14 días) para aprobar o pedir cambios. */
export async function enviarAbogado(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const v = leerVersion(datos);
  const correo = String(datos.get("abogado") ?? "").trim().toLowerCase();
  if (!v.p_id) return { error: "Recarga la página e intenta de nuevo." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return { error: "Escribe el correo del abogado." };
  const guardado = await staff.supabase.rpc("consola_guardar_version", { ...v, p_id: v.p_id, p_vigente: v.p_vigente as string });
  if (guardado.error) return { error: mensajeError(guardado.error) };
  const token = randomBytes(24).toString("base64url");
  const { error } = await staff.supabase.rpc("consola_pedir_revision", { p_id: v.p_id, p_correo: correo, p_token: token });
  if (error) return { error: mensajeError(error) };
  const documento = String(datos.get("documento") ?? "Documento");
  const version = String(datos.get("version") ?? "");
  const vence = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const r = await enviarCorreo({
    para: correo,
    etiqueta: "legal",
    contenido: correoRevisionLegal({ quien: staff.nombre, documento, version, url: `${sitio()}/legal/revision/${token}`, vence: formatearFechaLarga(vence) }),
  });
  refrescar();
  if (!r.enviado) return { error: "Quedó en revisión, pero el correo no salió. Revisa la integración de correo y vuelve a enviarlo." };
  return { ok: `Enviado a ${correo}. Cuando apruebe, podrás publicarla.` };
}

export async function publicarVersion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = idDe(datos);
  if (!id) return { error: "Recarga la página e intenta de nuevo." };
  const { error } = await staff.supabase.rpc("consola_publicar_version", { p_id: id });
  if (error) return { error: mensajeError(error) };
  refrescar();
  revalidatePath("/", "layout");
  return { ok: "Publicada. Rige desde la fecha elegida." };
}

/** Un solo formulario para el editor: el botón que se tocó decide (guardar o enviar al abogado). */
export async function accionVersion(estado: Estado, datos: FormData): Promise<Estado> {
  return datos.get("operacion") === "abogado" ? enviarAbogado(estado, datos) : guardarVersion(estado, datos);
}
