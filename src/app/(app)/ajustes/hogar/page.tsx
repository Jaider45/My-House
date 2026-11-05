import { Suspense } from "react";
import { Cargando, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { FormularioHogar } from "./formulario";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";

export const metadata = { title: "Hogar" };

export default function Hogar() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/hogar" />
      <Tarjeta>
        <Suspense fallback={<Cargando compacto />}>
          <Contenido />
        </Suspense>
      </Tarjeta>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  return <FormularioHogar nombre={ctx.hogar.nombre} cuota={ctx.hogar.cuotaImprevistosPct} editable={ctx.esAdmin} />;
}
