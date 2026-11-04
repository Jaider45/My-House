import { Suspense } from "react";
import { Tarjeta } from "@/components/ui";
import { FormularioIngreso } from "../formularios";

export const metadata = { title: "Ingresar" };

export default function Ingresar() {
  return (
    <Tarjeta titulo="Ingresar">
      <Suspense>
        <FormularioIngreso />
      </Suspense>
    </Tarjeta>
  );
}
