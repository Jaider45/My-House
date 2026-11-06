import { Tarjeta } from "@/components/ui";
import { FormularioContrasena } from "../formularios";

export const metadata = { title: "Contraseña nueva" };

/** Destino del enlace de recuperación (vía /auth/confirmar, que ya abrió la sesión). Requiere sesión: el proxy lo exige. */
export default function NuevaContrasena() {
  return (
    <Tarjeta titulo="Crea tu contraseña nueva">
      <FormularioContrasena recuperacion />
    </Tarjeta>
  );
}
