"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { correoCampana } from "@/lib/correo/correos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";

/** Lo escrito en el formulario: React vacía los campos no controlados tras cada acción, así que vuelve en el estado. */
export type EstadoCampana = (NonNullable<Estado> & { valores?: Record<string, string> }) | null;

const SIN_PERMISO = "Solo Contenido o un superadmin manejan campañas.";

const esquema = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Ponle nombre a la campaña.").max(80),
  segmento: z.enum(["todos", "gratis", "familia", "prueba", "mora", "inactivos"], "Elige el segmento."),
  asunto: z.string().trim().min(1, "Escribe el asunto.").max(150),
  titulo: z.string().trim().min(1, "Escribe el título.").max(150),
  cuerpo: z.string().trim().min(1, "Escribe el mensaje.").max(2000),
  boton_texto: z.string().trim().max(40).optional(),
  boton_url: z
    .string()
    .trim()
    .max(300)
    .regex(/^$|^https?:\/\/|^\//, "El enlace empieza por / o por https://")
    .optional(),
  fecha: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^$|^\d{2}:\d{2}$/).optional(),
});

async function conPermiso() {
  const staff = await obtenerStaff();
  return staff.puede("campanas") ? staff : null;
}

function leer(datos: FormData) {
  const r = esquema.safeParse({
    id: datos.get("id") || undefined,
    nombre: datos.get("nombre"),
    segmento: datos.get("segmento"),
    asunto: datos.get("asunto"),
    titulo: datos.get("titulo"),
    cuerpo: datos.get("cuerpo"),
    boton_texto: datos.get("boton_texto") ?? "",
    boton_url: datos.get("boton_url") ?? "",
    fecha: datos.get("fecha") ?? "",
    hora: datos.get("hora") ?? "",
  });
  if (!r.success) return { error: r.error.issues[0].message } as const;
  if (r.data.boton_url && !r.data.boton_texto) return { error: "Ponle texto al botón o quita el enlace." } as const;
  // Hora de Bogotá; el cron diario de las 7:15 a. m. la recoge cuando ya pasó.
  const programada = r.data.fecha ? `${r.data.fecha}T${r.data.hora || "07:00"}:00-05:00` : null;
  return { datos: r.data, programada } as const;
}

const escrito = (datos: FormData): Record<string, string> =>
  Object.fromEntries(["nombre", "segmento", "asunto", "titulo", "cuerpo", "boton_texto", "boton_url", "fecha", "hora"].map((k) => [k, String(datos.get(k) ?? "")]));

export async function guardarCampana(_: EstadoCampana, datos: FormData): Promise<EstadoCampana> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO, valores: escrito(datos) };
  const r = leer(datos);
  if ("error" in r) return { error: r.error, valores: escrito(datos) };
  const { error } = await staff.supabase.rpc("consola_guardar_campana", {
    p_id: (r.datos.id ?? null) as string,
    p_nombre: r.datos.nombre,
    p_segmento: r.datos.segmento,
    p_asunto: r.datos.asunto,
    p_titulo: r.datos.titulo,
    p_cuerpo: r.datos.cuerpo,
    p_boton_texto: (r.datos.boton_texto || null) as string,
    p_boton_url: (r.datos.boton_url || null) as string,
    p_programada: r.programada as string,
  });
  if (error) return { error: mensajeError(error), valores: escrito(datos) };
  revalidatePath("/consola/comunicaciones");
  return {
    ok: r.programada ? "Campaña programada: el envío diario de las 7:15 a. m. la recoge." : "Borrador guardado.",
    valores: escrito(datos),
  };
}

export async function cancelarCampana(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO };
  const id = z.uuid().safeParse(datos.get("id"));
  if (!id.success) return { error: "Campaña no válida." };
  const { error } = await staff.supabase.rpc("consola_cancelar_campana", { p_id: id.data });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/consola/comunicaciones");
  return { ok: "Campaña cancelada." };
}

/** Envía la campaña (como quedó en el formulario) solo a tu correo, para verla antes de programarla. */
export async function enviarCampanaPrueba(_: EstadoCampana, datos: FormData): Promise<EstadoCampana> {
  const staff = await conPermiso();
  if (!staff) return { error: SIN_PERMISO, valores: escrito(datos) };
  const r = leer(datos);
  if ("error" in r) return { error: r.error, valores: escrito(datos) };
  const envio = await enviarCorreo({
    para: staff.email,
    etiqueta: "campana-prueba",
    contenido: correoCampana({
      nombre: staff.nombre.split(" ")[0],
      asunto: `[Prueba] ${r.datos.asunto}`,
      titulo: r.datos.titulo,
      cuerpo: r.datos.cuerpo,
      botonTexto: r.datos.boton_texto,
      botonUrl: r.datos.boton_url,
      sitio: sitio(),
    }),
  });
  const valores = escrito(datos);
  return envio.enviado
    ? { ok: `Prueba enviada a ${staff.email}.`, valores }
    : { error: envio.error ? `No salió: ${envio.error}` : "El correo no está conectado (Integraciones).", valores };
}
