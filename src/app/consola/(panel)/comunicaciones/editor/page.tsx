import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Titulo } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import type { BloqueCorreo } from "@/lib/correo/bloques";
import { SEGMENTOS, type Segmentos } from "../segmentos";
import { EditorCampana, type OpcionSegmento } from "./editor";
import type { DatosCampana } from "../editor-acciones";

export const metadata: Metadata = { title: "Editor de campaña" };

type Propio = { id: string; nombre: string; hogares: number; con_permiso: number };

/** Diseño «Editor de correo»: arrastra bloques, revisa en escritorio o celular, elige audiencia y programa. */
export default async function EditorCorreo({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const staff = await obtenerStaff();
  const { id } = await searchParams;
  if (!staff.puede("campanas")) {
    return (
      <>
        <Titulo registrar={false}>Editor de campaña</Titulo>
        <Aviso tipo="info">Crear campañas es del rol Contenido o un superadmin.</Aviso>
      </>
    );
  }
  const [{ data: campanas }, { data: fijos }, { data: propios }] = await Promise.all([
    staff.supabase.rpc("consola_campanas"),
    staff.supabase.rpc("consola_segmentos"),
    staff.supabase.rpc("consola_segmentos_todos"),
  ]);
  const c = id ? (campanas ?? []).find((x) => x.id === id) : undefined;
  const conteo = (fijos ?? {}) as Segmentos;
  const segmentos: OpcionSegmento[] = [
    ...SEGMENTOS.map((s) => ({ valor: s.valor, texto: s.texto, personas: conteo[s.valor]?.con_permiso ?? 0, sin_permiso: (conteo[s.valor]?.hogares ?? 0) - (conteo[s.valor]?.con_permiso ?? 0) })),
    ...(((propios as { propios?: Propio[] } | null)?.propios ?? []) as Propio[]).map((p) => ({ valor: "propio", propio: p.id, texto: p.nombre, personas: p.con_permiso, sin_permiso: p.hogares - p.con_permiso })),
  ];
  const programada = c?.programada_para ? new Date(new Date(c.programada_para).getTime() - 5 * 3600_000).toISOString().slice(0, 16) : "";
  const inicial: DatosCampana = {
    id: c?.id ?? null,
    nombre: c?.nombre ?? "Campaña nueva",
    segmento: c?.segmento ?? "gratis",
    segmento_propio: c?.segmento_propio ?? null,
    asunto: c?.asunto ?? "",
    asunto_b: c?.asunto_b ?? "",
    prueba_ab_pct: c?.prueba_ab_pct || 20,
    vista_previa: c?.vista_previa ?? "",
    bloques:
      (c?.bloques as BloqueCorreo[] | null) ??
      (c
        ? [
            { tipo: "titulo", texto: c.titulo },
            { tipo: "texto", texto: c.cuerpo },
            ...(c.boton_texto && c.boton_url ? [{ tipo: "boton", texto: c.boton_texto, url: c.boton_url, estilo: "principal", alinear: "izquierda" } as BloqueCorreo] : []),
          ]
        : []),
    programada,
  };
  const bloqueada = c && !["borrador", "programada", "cancelada"].includes(c.estado);
  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Campaña de correo · arrastra bloques y edita a la derecha"
        accion={
          <Link href="/consola/comunicaciones" className="text-sm font-semibold underline-offset-4 hover:underline">
            ← Correos y campañas
          </Link>
        }
      >
        {c?.nombre ?? "Campaña nueva"}
      </Titulo>
      {bloqueada ? (
        <Aviso tipo="info">Esta campaña ya salió: puedes ver sus resultados en Correos y campañas.</Aviso>
      ) : (
        <EditorCampana inicial={inicial} segmentos={segmentos} programada={c?.estado === "programada"} />
      )}
    </>
  );
}
