import Link from "next/link";
import { Suspense } from "react";
import { Aviso, Cargando, EnlaceBoton, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { hoy, sumarDias } from "@/lib/fechas";
import { RegistroRapido } from "./registro-rapido";

export const metadata = { title: "Registrar" };

export default function Rapido() {
  return (
    <>
      <Titulo>Registrar</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

/** Categorías ordenadas por uso en los últimos 90 días. */
function masUsadas(filas: { category_id: string | null }[]): string[] {
  const conteo = new Map<string, number>();
  for (const f of filas) if (f.category_id) conteo.set(f.category_id, (conteo.get(f.category_id) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

async function Contenido() {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return <Aviso>Su rol es de solo lectura.</Aviso>;
  const hace90 = sumarDias(hoy(), -90);
  const [catalogos, { data: recientes }] = await Promise.all([
    cargarCatalogos(ctx),
    ctx.supabase.from("transactions").select("category_id").gte("fecha", hace90).not("category_id", "is", null).limit(2000),
  ]);

  if (!catalogos.cuentas.length) {
    return (
      <div className="space-y-3">
        <Aviso tipo="info">Para registrar, primero cree una cuenta (banco, efectivo o tarjeta).</Aviso>
        <EnlaceBoton href="/cuentas" className="w-full">
          Crear cuenta
        </EnlaceBoton>
      </div>
    );
  }

  return (
    <>
      <RegistroRapido cuentas={catalogos.cuentas} categorias={catalogos.categorias} frecuentes={masUsadas(recientes ?? [])} hoy={hoy()} />
      <p className="mt-6 text-center text-sm">
        <Link href="/movimientos/nuevo" className="text-teal-700">
          Transferencia, otra fecha o más detalles →
        </Link>
      </p>
    </>
  );
}
