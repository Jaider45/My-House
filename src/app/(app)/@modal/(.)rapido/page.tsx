import { Suspense } from "react";
import { PantallaRegistrar } from "../../rapido/pantalla";

/** /rapido abierto desde otra pantalla: la ventana queda encima de lo que estabas viendo (diseño «Registrar»). */
export default function RegistrarEncima() {
  return (
    <Suspense>
      <PantallaRegistrar sobrePantalla />
    </Suspense>
  );
}
