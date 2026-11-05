import Link from "next/link";
import { Aviso, EnlaceBoton } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { hoy, sumarDias } from "@/lib/fechas";
import { RegistroRapido } from "./registro-rapido";

export const metadata = { title: "Registrar" };

export default function Rapido() {
  return (
    <section aria-labelledby="titulo-registro" className="mx-auto w-full max-w-[560px] rounded-[20px] bg-elevada text-tinta shadow-[0_24px_64px_rgba(20,61,51,0.12)] md:mt-6">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2 md:px-6">
        <h1 id="titulo-registro" className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">
          Registrar movimiento
        </h1>
        <Link href="/" aria-label="Cerrar" className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-mosaico">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>
      <div className="px-5 pt-2 pb-5 md:px-6 md:pb-6">
        <Contenido />
      </div>
    </section>
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
  if (!ctx.puedeEditar) return <Aviso>Tu rol es de solo lectura.</Aviso>;
  const hace90 = sumarDias(hoy(), -90);
  const [catalogos, { data: recientes }] = await Promise.all([
    cargarCatalogos(ctx),
    ctx.supabase.from("transactions").select("category_id").gte("fecha", hace90).not("category_id", "is", null).limit(2000),
  ]);

  if (!catalogos.cuentas.length) {
    return (
      <div className="space-y-3">
        <Aviso tipo="info">Para registrar, primero crea una cuenta (banco, efectivo o tarjeta).</Aviso>
        <EnlaceBoton href="/cuentas" className="w-full">
          Crear cuenta
        </EnlaceBoton>
      </div>
    );
  }

  return (
    <>
      <RegistroRapido cuentas={catalogos.cuentas} categorias={catalogos.categorias} frecuentes={masUsadas(recientes ?? [])} hoy={hoy()} />
      <p className="mt-5 flex flex-col gap-2 border-t border-divisor pt-4 text-center text-sm">
        <Link href="/comprobantes" className="font-semibold hover:underline">
          Subir foto o PDF de un comprobante →
        </Link>
        <Link href="/movimientos/nuevo" className="font-semibold hover:underline">
          Transferencia, otra fecha o más detalles →
        </Link>
      </p>
    </>
  );
}
