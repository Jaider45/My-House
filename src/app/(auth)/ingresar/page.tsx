import { Suspense } from "react";
import { Tarjeta } from "@/components/ui";
import { FormularioIngreso } from "../formularios";

export const metadata = { title: "Inicia sesión" };

export default function Ingresar() {
  return (
    <Tarjeta titulo={<span className="text-[26px] leading-8 font-bold">Inicia sesión</span>} subtitulo="Qué bueno verte de nuevo.">
      <Suspense>
        <FormularioIngreso />
      </Suspense>
    </Tarjeta>
  );
}
