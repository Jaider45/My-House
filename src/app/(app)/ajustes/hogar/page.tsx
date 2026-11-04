import { Suspense } from "react";
import { Cargando, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { FormularioHogar } from "./formulario";

export const metadata = { title: "Hogar" };

export default function Hogar() {
  return (
    <>
      <Titulo>Hogar</Titulo>
      <Tarjeta>
        <Suspense fallback={<Cargando />}>
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
