import { Suspense } from "react";
import { Tarjeta } from "@/components/ui";
import { FormularioRegistro } from "../formularios";

export const metadata = { title: "Crear cuenta" };

export default function Registro() {
  return (
    <Tarjeta titulo="Crear cuenta">
      <Suspense>
        <FormularioRegistro />
      </Suspense>
    </Tarjeta>
  );
}
