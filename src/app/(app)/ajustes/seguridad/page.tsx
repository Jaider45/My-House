import { Tarjeta, Titulo } from "@/components/ui";
import { Contrasena, EstadoDosPasos } from "./componentes";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";
import { BotonGuia } from "@/components/guia/boton-guia";

export const metadata = { title: "Seguridad" };

export default function Seguridad() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores" accion={<BotonGuia id="dos_pasos">Cómo activar dos pasos</BotonGuia>}>
        Configuración
      </Titulo>
      <PestanasConfiguracion actual="/ajustes/seguridad" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Contraseña">
          <Contrasena />
        </Tarjeta>
        <Tarjeta guia="dos-pasos" titulo="Verificación en dos pasos">
          <EstadoDosPasos />
        </Tarjeta>
      </div>
    </>
  );
}
