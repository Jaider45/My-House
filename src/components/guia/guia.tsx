import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { leerVistas } from "@/lib/guias";
import { MotorGuia } from "./motor";

/** Motor de guías en el layout: las guías ya hechas viajan en el JWT (sin consultar la base). */
export async function Guia() {
  const [{ user }, ctx] = await Promise.all([obtenerUsuario(), obtenerContexto()]);
  return <MotorGuia vistas={leerVistas(user.user_metadata)} nombre={ctx.miembro.nombre.split(/\s+/)[0] ?? ""} rol={ctx.miembro.rol} />;
}
