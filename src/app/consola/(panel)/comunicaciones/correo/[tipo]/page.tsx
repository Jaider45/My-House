import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Tarjeta, Titulo, cx } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import { muestras } from "@/lib/correo/muestras";
import { armarCorreo, plano } from "@/lib/correo/plantilla";
import { sitio } from "@/lib/correo/enviar";
import { AUTOMATICOS } from "@/lib/correo/automaticos";
import { aplicarTextos, EDITABLES, type TextosCorreo } from "@/lib/correo/textos";
import { TextosCorreoForm } from "./textos";

export const metadata: Metadata = { title: "Correo automático" };

/**
 * Un correo automático: vista previa con datos de ejemplo (el mismo HTML que reciben las personas) y, si es de los
 * que envía la app, sus textos editables. `tipo` es la muestra o la clave de textos (los cobros tienen varias).
 */
export default async function VistaCorreo({ params }: { params: Promise<{ tipo: string }> }) {
  const staff = await obtenerStaff();
  const { tipo } = await params;
  const editable = EDITABLES.find((e) => e.clave === tipo) ?? EDITABLES.find((e) => e.muestra === tipo);
  const m = muestras(sitio())[editable?.muestra ?? tipo];
  if (!m) notFound();
  const auto = AUTOMATICOS.find((a) => editable && a.etiquetas.includes(editable.clave)) ?? AUTOMATICOS.find((a) => a.muestra === tipo || a.clave === tipo);
  // Variantes del mismo correo automático (p. ej. Cobros del plan: renovación, mora, paso a Gratis…).
  const hermanos = auto ? EDITABLES.filter((e) => auto.etiquetas.includes(e.clave) || (auto.clave === "plazo" && e.clave === "plazo")) : [];
  const { data: fila } = editable ? await staff.supabase.from("plataforma_config").select("valor").eq("clave", "correos_textos").maybeSingle() : { data: null };
  const actuales = editable ? (((fila?.valor ?? {}) as Record<string, TextosCorreo>)[editable.clave] ?? {}) : {};
  const contenido = aplicarTextos(m.contenido, actuales);
  const { asunto, html } = armarCorreo(contenido, sitio());
  const o = m.contenido;
  const originales = {
    asunto: plano(o.asunto),
    vista_previa: plano(o.vistaPrevia),
    titulo: plano(o.titulo),
    intro: plano(o.intro),
    nota: o.nota ? plano(o.nota.texto) : "",
    boton: o.botones?.[0]?.texto ?? "",
  };
  return (
    <>
      <Titulo
        registrar={false}
        subtitulo={`Asunto: ${asunto}${auto ? ` · ${auto.cuando}` : ""}`}
        accion={
          <Link href="/consola/comunicaciones?tab=automaticos" className="text-sm font-semibold underline-offset-4 hover:underline">
            ← Correos automáticos
          </Link>
        }
      >
        {editable?.nombre ?? auto?.nombre ?? m.nombre}
      </Titulo>
      {hermanos.length > 1 && (
        <nav aria-label="Variantes" className="mb-4 flex flex-wrap gap-2">
          {hermanos.map((h) => (
            <Link
              key={h.clave}
              href={`/consola/comunicaciones/correo/${h.clave}`}
              aria-current={h.clave === editable?.clave ? "page" : undefined}
              className={cx("inline-flex h-9 items-center rounded-full border px-3 text-sm", h.clave === editable?.clave ? "border-monte bg-monte text-arena" : "border-control bg-elevada hover:bg-mosaico")}
            >
              {h.nombre}
            </Link>
          ))}
        </nav>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,720px)_minmax(320px,1fr)]">
        <iframe title={`Vista previa: ${m.nombre}`} srcDoc={html} sandbox="" className="h-[820px] w-full rounded-2xl border border-borde bg-white" />
        {editable ? (
          <Tarjeta titulo="Textos" subtitulo="Con datos de ejemplo en la vista previa">
            <TextosCorreoForm clave={editable.clave} actuales={actuales} originales={originales} variables={Object.keys(o.variables ?? {})} puede={staff.puede("campanas")} />
          </Tarjeta>
        ) : (
          <p className="text-sm text-tenue">
            {auto?.envia === "supabase"
              ? "Este correo lo envía Supabase con las plantillas de supabase/templates (se suben con scripts/subir-correos-supabase.mjs)."
              : "Este correo no tiene textos editables."}
          </p>
        )}
      </div>
    </>
  );
}
