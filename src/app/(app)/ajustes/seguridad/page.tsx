import { Tarjeta, Titulo } from "@/components/ui";
import { FormularioContrasena } from "@/app/(auth)/formularios";
import { DosPasos } from "./dos-pasos";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";

export const metadata = { title: "Seguridad" };

export default function Seguridad() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/seguridad" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Contraseña">
          <FormularioContrasena />
        </Tarjeta>
        <Tarjeta titulo="Verificación en dos pasos">
          <DosPasos />
        </Tarjeta>
      </div>
    </>
  );
}
