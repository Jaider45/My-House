import { Aviso } from "@/components/ui";
import { obtenerUsuario } from "@/lib/sesion";

/** Aviso fijo cuando el equipo de My House suspendió el hogar (sale del JWT: sin consulta a la base). */
export async function AvisoSuspendido() {
  const { hogar } = await obtenerUsuario();
  if (!hogar?.suspendido) return null;
  return (
    <div className="mb-4">
      <Aviso>Tu hogar está suspendido: puedes ver tus datos, pero no registrar ni cambiar nada. Escríbenos para resolverlo.</Aviso>
    </div>
  );
}
