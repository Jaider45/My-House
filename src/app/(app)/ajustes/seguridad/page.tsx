import { Tarjeta, Titulo } from "@/components/ui";
import { DosPasos } from "./dos-pasos";

export const metadata = { title: "Seguridad" };

export default function Seguridad() {
  return (
    <>
      <Titulo>Seguridad</Titulo>
      <Tarjeta titulo="Verificación en dos pasos">
        <DosPasos />
      </Tarjeta>
    </>
  );
}
