import { Suspense } from "react";
import { Aviso, Boton, Cargando, EnlaceBoton, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { formatearFecha } from "@/lib/fechas";
import type { Mapeo } from "@/lib/importacion";
import { deshacerLote } from "./acciones";
import { Importador } from "./importador";

export const metadata = { title: "Importar extracto" };

export default function Importar() {
  return (
    <>
      <Titulo>Importar extracto</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return <Aviso>Su rol es de solo lectura.</Aviso>;
  const [catalogos, { data: cuentas }, { data: lotes }] = await Promise.all([
    cargarCatalogos(ctx),
    ctx.supabase.from("accounts").select("id, nombre, mapeo_csv").eq("archivada", false).order("created_at"),
    ctx.supabase
      .from("import_batches")
      .select("id, archivo_nombre, filas_importadas, created_at, accounts(nombre)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!cuentas?.length) {
    return (
      <div className="space-y-3">
        <Aviso tipo="info">Primero cree la cuenta a la que pertenece el extracto.</Aviso>
        <EnlaceBoton href="/cuentas" className="w-full">
          Crear cuenta
        </EnlaceBoton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-tenue">
        Descargue el extracto en CSV desde la banca en línea. Se detectan los movimientos que ya estaban (aunque los
        extractos se solapen) y se recuerda el formato de cada cuenta.
      </p>
      <Importador
        cuentas={cuentas.map((c) => ({ ...c, mapeo_csv: c.mapeo_csv as Mapeo | null }))}
        categorias={catalogos.categorias}
      />
      <Tarjeta titulo="Importaciones recientes">
        {lotes?.length ? (
          <ul className="divide-y divide-divisor">
            {lotes.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">{l.archivo_nombre}</span>
                  <span className="text-xs text-tenue">
                    {l.accounts?.nombre} · {l.filas_importadas} movimientos · {formatearFecha(l.created_at.slice(0, 10))}
                  </span>
                </span>
                <form action={deshacerLote}>
                  <input type="hidden" name="id" value={l.id} />
                  <Boton type="submit" variante="peligro" className="min-h-9 px-3 text-xs">
                    Deshacer
                  </Boton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>Aún no ha importado extractos.</Vacio>
        )}
      </Tarjeta>
    </div>
  );
}
