import { Tarjeta, Titulo } from "@/components/ui";
import { FormularioContrasena } from "@/app/(auth)/formularios";
import { verificoCorreoHacePoco } from "@/lib/contrasena";
import { obtenerUsuario } from "@/lib/sesion";
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
          <Contrasena />
        </Tarjeta>
        <Tarjeta titulo="Verificación en dos pasos">
          <DosPasos />
        </Tarjeta>
      </div>
    </>
  );
}

/** Quien entró hace poco con un código o enlace al correo puede crear una contraseña sin escribir la actual. */
async function Contrasena() {
  const { amr } = await obtenerUsuario();
  const sinActual = verificoCorreoHacePoco(amr);
  return (
    <div className="space-y-4">
      {sinActual && <p className="text-sm text-cuerpo">Entraste con un código al correo: puedes crear una contraseña sin escribir la anterior.</p>}
      <FormularioContrasena pideActual={!sinActual} />
    </div>
  );
}
