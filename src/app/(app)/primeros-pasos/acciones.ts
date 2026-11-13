"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { mensajeError, SOLO_LECTURA, type Estado } from "@/lib/acciones";
import { conPreferencias, esClavePaso, leerPreferencias, type PreferenciasRecorrido } from "@/lib/recorrido";

/**
 * Preferencias del recorrido en `user_metadata` (por persona y hogar). Se refresca la sesión para que el JWT
 * nuevo las traiga: la barra las lee de ahí sin consultar la base.
 */
async function guardar(cambiar: (p: PreferenciasRecorrido) => PreferenciasRecorrido): Promise<Estado> {
  const [ctx, { user }] = await Promise.all([obtenerContexto(), obtenerUsuario()]);
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  // El JWT puede estar unos segundos atrás de lo guardado: se parte de lo que tiene Auth.
  const { data: actual } = await ctx.supabase.auth.getUser();
  const meta = actual.user?.user_metadata ?? user.user_metadata;
  const nuevas = cambiar(leerPreferencias(meta, ctx.hogar.id));
  const { error } = await ctx.supabase.auth.updateUser({ data: { recorrido: conPreferencias(meta, ctx.hogar.id, nuevas) } });
  if (error) return { error: mensajeError(error) };
  await ctx.supabase.auth.refreshSession();
  revalidatePath("/", "layout");
  return { ok: "Listo." };
}

export async function omitirPaso(_: Estado, datos: FormData): Promise<Estado> {
  const clave = datos.get("paso");
  if (!esClavePaso(clave)) return { error: "Paso no válido." };
  return guardar((p) => ({ ...p, omitidos: [...p.omitidos, clave] }));
}

export async function retomarPaso(_: Estado, datos: FormData): Promise<Estado> {
  const clave = datos.get("paso");
  if (!esClavePaso(clave)) return { error: "Paso no válido." };
  return guardar((p) => ({ ...p, oculto: false, omitidos: p.omitidos.filter((c) => c !== clave) }));
}

export async function ocultarRecorrido(): Promise<Estado> {
  return guardar((p) => ({ ...p, oculto: true }));
}

export async function mostrarRecorrido(): Promise<Estado> {
  return guardar((p) => ({ ...p, oculto: false }));
}
