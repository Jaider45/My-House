"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { correoSolicitudDatos } from "@/lib/correo/correos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { crearClienteServicio, hayServicio, type Servicio } from "@/lib/supabase/servicio";

const SIN_PERMISO = "Solo un superadmin atiende solicitudes de datos personales.";
const TIPOS = ["consulta", "actualizacion", "supresion", "revocatoria", "reclamo"] as const;
const NOMBRE_TIPO: Record<string, string> = { consulta: "consulta", actualizacion: "corrección", supresion: "supresión", revocatoria: "revocatoria", reclamo: "reclamo" };

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("auditoria") ? staff : null;
}

export async function registrarSolicitud(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({
      tipo: z.enum(TIPOS),
      correo: z.email("Escribe el correo del titular."),
      nombre: z.string().trim().max(120).default(""),
      detalle: z.string().trim().max(2000).default(""),
      recibida: z.iso.date("Elige la fecha en que llegó."),
    })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const { error } = await staff.supabase.rpc("consola_registrar_solicitud", { p_tipo: r.data.tipo, p_correo: r.data.correo, p_nombre: r.data.nombre, p_detalle: r.data.detalle, p_recibida: r.data.recibida });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/privacidad");
  return { ok: "Solicitud registrada con su plazo." };
}

export async function responderSolicitud(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const r = z
    .object({ id: z.uuid(), estado: z.enum(["en_tramite", "resuelta", "rechazada"]), respuesta: z.string().trim().max(4000).default(""), numero: z.coerce.number().int(), tipo: z.enum(TIPOS) })
    .safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Datos no válidos." };
  const { data: correo, error } = await staff.supabase.rpc("consola_responder_solicitud", { p_id: r.data.id, p_estado: r.data.estado, p_respuesta: r.data.respuesta });
  if (error) return { error: mensajeError(error) };
  if (correo && r.data.estado !== "en_tramite") {
    await enviarCorreo({
      para: correo,
      etiqueta: "privacidad",
      contenido: correoSolicitudDatos({ numero: r.data.numero, tipo: NOMBRE_TIPO[r.data.tipo], estado: r.data.estado, respuesta: r.data.respuesta, url: `${sitio()}/ayuda` }),
    });
  }
  revalidatePath("/consola/privacidad");
  return { ok: r.data.estado === "en_tramite" ? "Marcada en trámite." : "Respuesta guardada y enviada al titular." };
}

/** Borra todos los archivos de un hogar en Storage (carpeta `soportes/<hogar>/`, con subcarpetas). */
async function borrarArchivos(db: Servicio, carpeta: string): Promise<number> {
  let borrados = 0;
  for (;;) {
    const { data, error } = await db.storage.from("soportes").list(carpeta, { limit: 1000 });
    if (error) throw new Error(`Storage: ${error.message}`);
    const archivos = data.filter((x) => x.id).map((x) => `${carpeta}/${x.name}`);
    for (const sub of data.filter((x) => !x.id)) borrados += await borrarArchivos(db, `${carpeta}/${sub.name}`);
    if (!archivos.length) return borrados;
    const { error: e } = await db.storage.from("soportes").remove(archivos);
    if (e) throw new Error(`Storage: ${e.message}`);
    borrados += archivos.length;
    if (archivos.length < 1000) return borrados;
  }
}

/**
 * Supresión completa (Ley 1581): archivos de los hogares propios, los hogares (cascada), los datos personales en los
 * compartidos y la cuenta de Auth. Los archivos van primero: si algo falla después, volver a ejecutar no deja huérfanos.
 */
export async function ejecutarSupresion(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Solicitud no válida." };
  if (String(datos.get("confirmar") ?? "").trim().toUpperCase() !== "SUPRIMIR") return { error: "Escribe SUPRIMIR para confirmar." };
  if (!hayServicio()) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: sin ella no se pueden borrar archivos ni la cuenta." };

  const previa = await staff.supabase.rpc("consola_supresion", { p_id: id.data, p_ejecutar: false });
  if (previa.error) return { error: mensajeError(previa.error) };
  const plan = previa.data as { user_id: string | null; borrar: string[]; es_staff: boolean };
  if (!plan.user_id) return { error: "La solicitud no tiene una cuenta asociada: atiéndela respondiendo al titular." };
  if (plan.es_staff) return { error: "Esa cuenta pertenece al equipo: primero retírala en Equipo y permisos." };

  const db = crearClienteServicio();
  let archivos = 0;
  try {
    for (const hogar of plan.borrar) archivos += await borrarArchivos(db, hogar);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No pude borrar los archivos." };
  }
  const hecha = await staff.supabase.rpc("consola_supresion", { p_id: id.data, p_ejecutar: true });
  if (hecha.error) return { error: mensajeError(hecha.error) };
  const { error: eAuth } = await db.auth.admin.deleteUser(plan.user_id);
  revalidatePath("/consola/privacidad");
  if (eAuth) return { error: `Datos suprimidos, pero la cuenta de acceso no se pudo cerrar: ${eAuth.message}. Vuelve a intentarlo desde Usuarios.` };
  return { ok: `Supresión ejecutada: ${plan.borrar.length} ${plan.borrar.length === 1 ? "hogar borrado" : "hogares borrados"}, ${archivos} archivos y la cuenta de acceso.` };
}
