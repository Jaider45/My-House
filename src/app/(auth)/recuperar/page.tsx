import { Suspense } from "react";
import { Tarjeta } from "@/components/ui";
import { FormularioRecuperar } from "../formularios";

export const metadata = { title: "Recuperar contraseña" };

export default function Recuperar() {
  return (
    <Tarjeta titulo="Recuperar contraseña">
      <Suspense>
        <FormularioRecuperar />
      </Suspense>
    </Tarjeta>
  );
}
