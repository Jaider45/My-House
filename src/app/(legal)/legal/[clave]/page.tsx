import { notFound } from "next/navigation";
import { DocumentoLegal } from "../../piezas";

export const metadata = { title: "Documento legal" };

/** Otros documentos que el equipo crea en Consola → Legal (aviso de privacidad, cookies, comunicaciones…). */
export default async function OtroDocumento({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(clave)) notFound();
  return <DocumentoLegal clave={clave} />;
}
