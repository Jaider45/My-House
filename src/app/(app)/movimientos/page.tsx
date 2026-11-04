import Link from "next/link";
import { Suspense } from "react";
import { Boton, Cargando, EnlaceBoton, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, formatearMes, hoy, mesDe, rangoMes, sumarMeses } from "@/lib/fechas";
import { opcionesCategoria } from "@/lib/categorias";
import { confirmarMovimiento } from "./acciones";

export const metadata = { title: "Movimientos" };

type Params = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  return (
    <>
      <Titulo accion={<EnlaceBoton href="/movimientos/nuevo" className="min-h-9 px-3">+ Nuevo</EnlaceBoton>}>Movimientos</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const mes = /^\d{4}-\d{2}$/.test(texto(sp.mes)) ? texto(sp.mes) : mesDe(hoy());
  const cuenta = texto(sp.cuenta);
  const categoria = texto(sp.categoria);
  const tipo = ["ingreso", "gasto", "transferencia"].includes(texto(sp.tipo)) ? (texto(sp.tipo) as "ingreso" | "gasto" | "transferencia") : "";
  const { desde, hasta } = rangoMes(mes);
  const catalogos = await cargarCatalogos(ctx);

  let consulta = ctx.supabase
    .from("transactions")
    .select("id, tipo, fecha, monto, comercio, estado, account_id, cuenta_destino_id, category_id")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (cuenta) consulta = consulta.or(`account_id.eq.${cuenta},cuenta_destino_id.eq.${cuenta}`);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (categoria === "sin") {
    consulta = consulta.is("category_id", null).neq("tipo", "transferencia");
  } else if (categoria) {
    const hijas = catalogos.categorias.filter((c) => c.padre_id === categoria).map((c) => c.id);
    consulta = consulta.in("category_id", [categoria, ...hijas]);
  }
  const { data: movimientos } = await consulta;

  const nombreCuenta = new Map(catalogos.cuentas.map((c) => [c.id, c.nombre]));
  const etiquetaCat = new Map(
    [...opcionesCategoria(catalogos.categorias, "gasto"), ...opcionesCategoria(catalogos.categorias, "ingreso")].map((o) => [o.id, o.etiqueta]),
  );
  for (const c of catalogos.categorias) if (!etiquetaCat.has(c.id)) etiquetaCat.set(c.id, c.nombre);

  const lista = movimientos ?? [];
  const suma = (t: string) => lista.filter((m) => m.tipo === t && m.estado === "confirmado").reduce((s, m) => s + m.monto, 0);
  const ingresos = suma("ingreso");
  const gastos = suma("gasto");
  const porDia = Map.groupBy(lista, (m) => m.fecha);

  const filtros = new URLSearchParams({ ...(cuenta && { cuenta }), ...(categoria && { categoria }), ...(tipo && { tipo }) });
  const enlaceMes = (m: string) => `/movimientos?${new URLSearchParams({ mes: m, ...Object.fromEntries(filtros) })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={enlaceMes(sumarMeses(mes, -1))} className="px-3 py-2 text-xl" aria-label="Mes anterior">
          ‹
        </Link>
        <span className="font-semibold first-letter:uppercase">{formatearMes(mes)}</span>
        <Link href={enlaceMes(sumarMeses(mes, 1))} className="px-3 py-2 text-xl" aria-label="Mes siguiente">
          ›
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta>
          <p className="text-xs text-zinc-500">Ingresos</p>
          <p className="font-bold text-emerald-600 tabular-nums">{formatearCOP(ingresos)}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs text-zinc-500">Gastos</p>
          <p className="font-bold text-red-600 tabular-nums">{formatearCOP(gastos)}</p>
        </Tarjeta>
      </div>

      <details className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800" open={filtros.size > 0}>
        <summary className="cursor-pointer text-sm font-semibold">Filtros{filtros.size > 0 && ` (${filtros.size})`}</summary>
        <form className="mt-3 grid gap-2" action="/movimientos">
          <input type="hidden" name="mes" value={mes} />
          <select name="tipo" defaultValue={tipo} className="min-h-10 rounded-lg border border-zinc-300 bg-transparent px-2 dark:border-zinc-700">
            <option value="">Todos los tipos</option>
            <option value="gasto">Gastos</option>
            <option value="ingreso">Ingresos</option>
            <option value="transferencia">Transferencias</option>
          </select>
          <select name="cuenta" defaultValue={cuenta} className="min-h-10 rounded-lg border border-zinc-300 bg-transparent px-2 dark:border-zinc-700">
            <option value="">Todas las cuentas</option>
            {catalogos.cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select name="categoria" defaultValue={categoria} className="min-h-10 rounded-lg border border-zinc-300 bg-transparent px-2 dark:border-zinc-700">
            <option value="">Todas las categorías</option>
            <option value="sin">Sin categoría</option>
            {catalogos.categorias
              .filter((c) => !c.padre_id)
              .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <Boton type="submit" className="flex-1">
              Filtrar
            </Boton>
            <EnlaceBoton href={`/movimientos?mes=${mes}`} variante="secundario" className="flex-1">
              Limpiar
            </EnlaceBoton>
          </div>
        </form>
      </details>

      {lista.length === 0 ? (
        <Vacio>No hay movimientos en este mes.</Vacio>
      ) : (
        [...porDia.entries()].map(([fecha, items]) => (
          <section key={fecha}>
            <h2 className="mb-1 px-1 text-xs font-semibold text-zinc-500 uppercase">{formatearFecha(fecha)}</h2>
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
              {items.map((m) => (
                <li key={m.id} className={`flex items-center gap-2 px-3 py-2 ${m.estado === "programado" ? "bg-amber-50/60 dark:bg-amber-950/30" : ""}`}>
                  <Link href={`/movimientos/${m.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {m.tipo === "transferencia"
                          ? `${nombreCuenta.get(m.account_id) ?? "?"} → ${nombreCuenta.get(m.cuenta_destino_id ?? "") ?? "?"}`
                          : (etiquetaCat.get(m.category_id ?? "") ?? "Sin categoría")}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {[m.comercio, m.tipo !== "transferencia" && nombreCuenta.get(m.account_id), m.estado === "programado" && "programado"]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        m.tipo === "ingreso" ? "text-emerald-600" : m.tipo === "gasto" ? "text-red-600" : "text-zinc-500"
                      }`}
                    >
                      {m.tipo === "ingreso" ? "+" : m.tipo === "gasto" ? "−" : ""}
                      {formatearCOP(m.monto)}
                    </span>
                  </Link>
                  {m.estado === "programado" && ctx.puedeEditar && (
                    <form action={confirmarMovimiento}>
                      <input type="hidden" name="id" value={m.id} />
                      <Boton type="submit" variante="secundario" className="min-h-8 px-2 text-xs">
                        Confirmar
                      </Boton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
