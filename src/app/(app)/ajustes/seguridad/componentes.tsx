import { FormularioContrasena } from "@/app/(auth)/formularios";
import { verificoCorreoHacePoco } from "@/lib/contrasena";
import { obtenerUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { DosPasos } from "./dos-pasos";

/** Quien entró hace poco con un código o enlace al correo puede crear una contraseña sin escribir la actual. */
export async function Contrasena() {
  const { amr } = await obtenerUsuario();
  const sinActual = verificoCorreoHacePoco(amr);
  return (
    <div className="space-y-4">
      {sinActual && <p className="text-sm text-cuerpo">Entraste con un código al correo: puedes crear una contraseña sin escribir la anterior.</p>}
      <FormularioContrasena pideActual={!sinActual} />
    </div>
  );
}

/** El estado se consulta en el servidor: la tarjeta llega pintada (antes decía «Consultando…» hasta que el navegador preguntaba). */
export async function EstadoDosPasos() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();
  return <DosPasos inicial={data?.totp.find((f) => f.status === "verified")?.id ?? null} />;
}
