import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { RESPONSABLE } from "./responsable";
import { variablesEmpresa, type Empresa } from "./empresa";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Datos de la empresa (Ajustes de la plataforma → Empresa). Vacíos → los del código (con marcadores). */
export const leerEmpresa = cache(async (): Promise<Empresa> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("plataforma_config").select("valor").eq("clave", "empresa").maybeSingle();
  return (data?.valor ?? {}) as Empresa;
});

export async function variablesLegales() {
  return variablesEmpresa(await leerEmpresa());
}

export type DocumentoPublicado = {
  clave: string;
  nombre: string;
  version: string;
  vigente_desde: string;
  contenido: string;
  /** Versión publicada que aún no entra en vigencia (se anuncia arriba del texto). */
  proxima: { version: string; vigente_desde: string; resumen: string } | null;
};

/** Versión vigente de un documento (y la próxima, si ya se publicó con fecha futura). Lectura pública (RLS). */
export async function documentoPublicado(clave: string, hoyBogota: string): Promise<DocumentoPublicado | null> {
  const supabase = await crearClienteServidor();
  const [{ data: doc }, { data: versiones }] = await Promise.all([
    supabase.from("documentos_legales").select("clave, nombre").eq("clave", clave).maybeSingle(),
    supabase.from("documento_versiones").select("version, vigente_desde, contenido, resumen").eq("documento", clave).order("vigente_desde", { ascending: false }),
  ]);
  if (!doc) return null;
  const vigente = (versiones ?? []).find((v) => v.vigente_desde && v.vigente_desde <= hoyBogota);
  if (!vigente) return null;
  const proxima = (versiones ?? []).find((v) => v.vigente_desde && v.vigente_desde > hoyBogota);
  return {
    clave: doc.clave,
    nombre: doc.nombre,
    version: vigente.version,
    vigente_desde: vigente.vigente_desde!,
    contenido: vigente.contenido,
    proxima: proxima ? { version: proxima.version, vigente_desde: proxima.vigente_desde!, resumen: proxima.resumen } : null,
  };
}

export type PendienteLegal = { clave: string; nombre: string; version: string; vigente_desde: string; resumen: string };

/** Documentos obligatorios que la persona aún no acepta en la versión exigida. */
export async function pendientesLegales(supabase: Cliente): Promise<PendienteLegal[]> {
  const { data, error } = await supabase.rpc("mis_pendientes_legales");
  if (error) return [];
  return (data ?? []) as PendienteLegal[];
}

export { RESPONSABLE };
