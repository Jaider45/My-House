import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Titulo } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import { muestras } from "@/lib/correo/muestras";
import { armarCorreo } from "@/lib/correo/plantilla";
import { sitio } from "@/lib/correo/enviar";
import { AUTOMATICOS } from "@/lib/correo/automaticos";

export const metadata: Metadata = { title: "Vista previa del correo" };

/** Vista previa de un correo automático con datos de ejemplo (el mismo HTML que reciben las personas). */
export default async function VistaCorreo({ params }: { params: Promise<{ tipo: string }> }) {
  await obtenerStaff();
  const { tipo } = await params;
  const m = muestras(sitio())[tipo];
  if (!m) notFound();
  const { asunto, html } = armarCorreo(m.contenido, sitio());
  const auto = AUTOMATICOS.find((a) => a.muestra === tipo);
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
        {auto?.nombre ?? m.nombre}
      </Titulo>
      <p className="mb-3 text-sm text-tenue">
        Con datos de ejemplo. El texto de los correos automáticos está en el código (src/lib/correo/correos.ts); los de acceso los envía Supabase con las plantillas de
        supabase/templates.
      </p>
      <iframe title={`Vista previa: ${m.nombre}`} srcDoc={html} sandbox="" className="h-[820px] w-full max-w-[720px] rounded-2xl border border-borde bg-white" />
    </>
  );
}
