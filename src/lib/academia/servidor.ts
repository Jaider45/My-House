import "server-only";
import { cache } from "react";
import type { crearClienteServidor } from "@/lib/supabase/server";
import type { Bloque, Curso } from "./index";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Rutas y lecciones publicadas (Consola → Academia), una vez por request. RLS deja ver solo lo publicado. */
export const cargarCursos = cache(async (supabase: Cliente): Promise<Curso[]> => {
  const [{ data: rutas }, { data: lecciones }] = await Promise.all([
    supabase.from("academia_rutas").select("slug, titulo, portada, descripcion, tema, icono, color").order("orden").order("titulo"),
    supabase.from("academia_lecciones").select("ruta, slug, titulo, minutos, bloques").order("orden").order("slug"),
  ]);
  return (rutas ?? [])
    .map((r) => ({
      slug: r.slug,
      titulo: r.titulo,
      portada: r.portada || r.titulo,
      descripcion: r.descripcion,
      tema: r.tema as Curso["tema"],
      icono: r.icono as Curso["icono"],
      color: r.color as Curso["color"],
      lecciones: (lecciones ?? []).filter((l) => l.ruta === r.slug).map((l) => ({ slug: l.slug, titulo: l.titulo, minutos: l.minutos, bloques: l.bloques as Bloque[] })),
    }))
    .filter((c) => c.lecciones.length > 0);
});

export type Recomendacion = { id: string; condicion: string; ruta: string; ruta_titulo: string; icono: string; leccion: string | null; leccion_titulo: string | null; minutos: number | null };

/** Recomendaciones de la Academia para este lugar según cómo va el hogar (reglas de la consola). */
export async function recomendaciones(supabase: Cliente, lugar: string): Promise<Recomendacion[]> {
  const { data } = await supabase.rpc("mis_recomendaciones", { p_lugar: lugar });
  return (data ?? []) as Recomendacion[];
}

/** Por qué se recomienda (texto de la tarjeta). */
export const PORQUE: Record<string, string> = {
  presupuesto_excedido: "Porque una categoría pasó su presupuesto",
  tope_dian: "Porque alguien del hogar pasó un tope DIAN",
  fondo_atrasado: "Porque el fondo de emergencia va atrasado",
  sin_fondo: "Porque aún no tienes fondo de emergencia",
  varias_deudas: "Porque tienes varias deudas",
  un_miembro_14d: "Para organizarse en pareja",
  sin_registro_7d: "Porque llevas días sin registrar",
  siempre: "Para empezar",
};
