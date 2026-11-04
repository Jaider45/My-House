import { Suspense } from "react";
import { Aviso, Boton, Cargando, EnlaceBoton, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, hoy } from "@/lib/fechas";
import { ETIQUETA_FRECUENCIA, montoMensual } from "@/lib/recurrentes";
import { cambiarEstadoRegla, eliminarRegla } from "./acciones";
import { FormularioRegla } from "./formulario";

export const metadata = { title: "Gastos recurrentes" };

export default function Recurrentes() {
  return (
    <>
      <Titulo>Recurrentes</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  const [catalogos, { data: reglas }] = await Promise.all([
    cargarCatalogos(ctx),
    ctx.supabase
      .from("recurring_rules")
      .select("id, descripcion, monto, tipo, account_id, category_id, frecuencia, fecha_inicio, proxima_fecha, activa")
      .order("activa", { ascending: false })
      .order("proxima_fecha"),
  ]);
  const nombreCuenta = new Map(catalogos.cuentas.map((c) => [c.id, c.nombre]));
  const nombreCat = new Map(catalogos.categorias.map((c) => [c.id, c.nombre]));
  const activas = (reglas ?? []).filter((r) => r.activa);
  const gastoMensual = activas.filter((r) => r.tipo === "gasto").reduce((s, r) => s + montoMensual(r.monto, r.frecuencia), 0);
  const fecha = hoy();

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Cada día se programan los pagos de los próximos 7 días. Aparecen en Movimientos como «programado» hasta que
        los confirme.
      </p>

      {activas.length > 0 && (
        <Tarjeta>
          <p className="text-sm text-zinc-500">Gastos recurrentes, equivalente mensual</p>
          <p className="text-2xl font-bold">{formatearCOP(gastoMensual)}</p>
        </Tarjeta>
      )}

      <Tarjeta titulo="Reglas">
        {reglas?.length ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {reglas.map((r) => (
              <li key={r.id} className={r.activa ? "" : "opacity-50"}>
                <details className="py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.descripcion}</span>
                      <span className="block text-xs text-zinc-500">
                        {ETIQUETA_FRECUENCIA[r.frecuencia]} · {nombreCat.get(r.category_id)} · {nombreCuenta.get(r.account_id) ?? "cuenta archivada"}
                        <br />
                        {r.activa ? `Próximo: ${formatearFecha(r.proxima_fecha)}` : "Pausada"}
                      </span>
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${r.tipo === "ingreso" ? "text-emerald-600" : ""}`}>
                      {formatearCOP(r.monto)}
                    </span>
                  </summary>
                  {ctx.puedeEditar && (
                    <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
                      <FormularioRegla regla={r} cuentas={catalogos.cuentas} categorias={catalogos.categorias} hoy={fecha} />
                      <form action={cambiarEstadoRegla}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="activar" value={r.activa ? "0" : "1"} />
                        <Boton type="submit" variante="secundario" className="w-full">
                          {r.activa ? "Pausar" : "Reactivar"}
                        </Boton>
                      </form>
                      <form action={eliminarRegla}>
                        <input type="hidden" name="id" value={r.id} />
                        <Boton type="submit" variante="peligro" className="w-full">
                          Eliminar regla
                        </Boton>
                      </form>
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>Sin reglas todavía. Agregue el arriendo, el colegio o los servicios.</Vacio>
        )}
      </Tarjeta>

      {ctx.puedeEditar &&
        (catalogos.cuentas.length ? (
          <Tarjeta titulo="Nueva regla">
            <FormularioRegla cuentas={catalogos.cuentas} categorias={catalogos.categorias} hoy={fecha} />
          </Tarjeta>
        ) : (
          <div className="space-y-3">
            <Aviso tipo="info">Primero cree una cuenta.</Aviso>
            <EnlaceBoton href="/cuentas" className="w-full">
              Crear cuenta
            </EnlaceBoton>
          </div>
        ))}
    </div>
  );
}
