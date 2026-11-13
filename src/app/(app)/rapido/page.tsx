import { PantallaRegistrar } from "./pantalla";

export const metadata = { title: "Registrar" };

/** /rapido abierto directo (enlace, recarga o acceso de la PWA): la ventana sola; al cerrarla vuelve a Inicio. */
export default function Rapido() {
  return <PantallaRegistrar sobrePantalla={false} />;
}
