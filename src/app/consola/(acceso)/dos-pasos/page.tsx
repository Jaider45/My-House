import type { Metadata } from "next";
import { destinoConsola } from "@/lib/consola/rutas";
import { ActivarDosPasos } from "./activar";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

/** Solo llega aquí (proxy) quien es del equipo y aún no tiene 2FA. */
export default async function DosPasosConsola({ searchParams }: PageProps<"/consola/dos-pasos">) {
  const { siguiente } = await searchParams;
  return <ActivarDosPasos siguiente={destinoConsola(siguiente)} />;
}
