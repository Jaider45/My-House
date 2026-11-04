import { Suspense } from "react";
import { Cargando, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";

export default function Inicio() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  return <Titulo>{ctx.hogar.nombre}</Titulo>;
}
