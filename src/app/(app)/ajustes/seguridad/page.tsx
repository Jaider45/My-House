import { Tarjeta, Titulo } from "@/components/ui";
import { DosPasos } from "./dos-pasos";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";

export const metadata = { title: "Seguridad" };

export default function Seguridad() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/seguridad" />
      <Tarjeta titulo="Verificación en dos pasos">
        <DosPasos />
      </Tarjeta>
    </>
  );
}
