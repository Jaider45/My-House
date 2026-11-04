import Link from "next/link";
import { Suspense } from "react";
import { Aviso, Cargando, EnlaceBoton, Tarjeta } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP, porcentaje } from "@/lib/dinero";
import { formatearMes, hoy, mesDe, rangoMes, sumarMeses } from "@/lib/fechas";
import { resumirMes, type TotalCategoria } from "@/lib/finanzas";
import type { Categoria } from "@/lib/categorias";

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Tablero searchParams={searchParams} />
    </Suspense>
  );
}

function Barra({ valor, total, color = "bg-teal-600" }: { valor: number; total: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, porcentaje(valor, total))}%` }} />
    </div>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${fuerte ? "border-t border-zinc-200 pt-2 font-bold dark:border-zinc-800" : "text-sm"}`}>
      <span>{etiqueta}</span>
      <span className="tabular-nums">{formatearCOP(valor)}</span>
    </div>
  );
}

async function Tablero({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const mesActual = mesDe(hoy());
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual;

  const [{ data: filas }, { data: categorias }, { count: personas }, { count: cuentas }, { count: sinCategoria }] = await Promise.all([
    ctx.supabase.rpc("totales_por_categoria", {
      p_household: ctx.hogar.id,
      p_desde: rangoMes(sumarMeses(mes, -3)).desde,
      p_hasta: rangoMes(mes).hasta,
    }),
    ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
    ctx.supabase.from("members").select("id", { count: "exact", head: true }),
    ctx.supabase.from("accounts").select("id", { count: "exact", head: true }),
    ctx.supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .neq("tipo", "transferencia")
      .is("category_id", null)
      .gte("fecha", rangoMes(mes).desde)
      .lte("fecha", rangoMes(mes).hasta),
  ]);

  const r = resumirMes({
    mes,
    filas: (filas ?? []) as TotalCategoria[],
    categorias: (categorias ?? []) as Categoria[],
    personas: personas ?? 1,
    cuotaImprevistosPct: ctx.hogar.cuotaImprevistosPct,
  });
  const balance = r.ingresos - r.gastos;
  const maxCategoria = r.porCategoria[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">{ctx.hogar.nombre}</p>
          <h1 className="text-xl font-bold first-letter:uppercase">{formatearMes(mes)}</h1>
        </div>
        <nav className="flex gap-1 text-xl">
          <Link href={`/?mes=${sumarMeses(mes, -1)}`} className="px-3 py-1" aria-label="Mes anterior">
            ‹
          </Link>
          {mes !== mesActual && (
            <Link href="/" className="px-3 py-1" aria-label="Mes actual">
              ›
            </Link>
          )}
        </nav>
      </header>

      {!cuentas && (
        <Aviso tipo="info">
          Para empezar, cree sus cuentas (banco, efectivo, tarjeta).{" "}
          <Link href="/cuentas" className="font-semibold underline">
            Crear cuenta
          </Link>
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta>
          <p className="text-xs text-zinc-500">Ingresos</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatearCOP(r.ingresos)}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs text-zinc-500">Gastos</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">{formatearCOP(r.gastos)}</p>
        </Tarjeta>
      </div>
      <Tarjeta>
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-zinc-500">Le queda este mes</p>
          <p className={`text-xl font-bold tabular-nums ${balance < 0 ? "text-red-600" : ""}`}>{formatearCOP(balance)}</p>
        </div>
        {r.porPagar > 0 && (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            <Link href={`/movimientos?mes=${mes}`} className="underline">
              {formatearCOP(r.porPagar)} programados por pagar
            </Link>
          </p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Costo de vida">
        <p className="text-2xl font-bold tabular-nums">{formatearCOP(r.costoVida)}</p>
        <p className="mb-3 text-sm text-zinc-500">
          {formatearCOP(r.costoPorPersona)} por persona ({personas ?? 1} en el hogar)
          {r.ahorro > 0 && ` · ${formatearCOP(r.ahorro)} a ahorro, aparte`}
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Fijos</span>
            <span className="tabular-nums">
              {formatearCOP(r.fijos)} · {porcentaje(r.fijos, r.costoVida)} %
            </span>
          </div>
          <Barra valor={r.fijos} total={r.costoVida} color="bg-teal-700" />
          <div className="flex justify-between">
            <span>Variables</span>
            <span className="tabular-nums">
              {formatearCOP(r.variables)} · {porcentaje(r.variables, r.costoVida)} %
            </span>
          </div>
          <Barra valor={r.variables} total={r.costoVida} color="bg-amber-500" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Número mínimo del hogar">
        <p className="mb-3 text-sm text-zinc-500">Lo que el hogar necesita cada mes sí o sí.</p>
        <div className="space-y-1">
          <Fila etiqueta="Gastos fijos del mes" valor={r.numeroMinimo.fijos} />
          <Fila
            etiqueta={
              r.numeroMinimo.mesesPromedio
                ? `Variables esenciales (promedio ${r.numeroMinimo.mesesPromedio} ${r.numeroMinimo.mesesPromedio === 1 ? "mes" : "meses"})`
                : "Variables esenciales (este mes)"
            }
            valor={r.numeroMinimo.variablesEsenciales}
          />
          <Fila etiqueta={`Imprevistos (${ctx.hogar.cuotaImprevistosPct} %)`} valor={r.numeroMinimo.imprevistos} />
          <Fila etiqueta="Número mínimo" valor={r.numeroMinimo.total} fuerte />
        </div>
        {r.ingresos > 0 && (
          <p className="mt-2 text-xs text-zinc-500">Equivale al {porcentaje(r.numeroMinimo.total, r.ingresos)} % de los ingresos del mes.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Gasto por categoría">
        {r.porCategoria.length ? (
          <ul className="space-y-3">
            {r.porCategoria.map((c) => (
              <li key={c.id ?? "sin"}>
                <Link href={c.id ? `/movimientos?mes=${mes}&categoria=${c.id}` : `/movimientos?mes=${mes}`} className="block space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.nombre}</span>
                    <span className="tabular-nums">
                      {formatearCOP(c.total)} · {porcentaje(c.total, r.costoVida)} %
                    </span>
                  </div>
                  <Barra valor={c.total} total={maxCategoria} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Sin gastos registrados en este mes.</p>
        )}
        {(sinCategoria ?? 0) > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            <Link href={`/movimientos?mes=${mes}&categoria=sin`} className="underline">
              {sinCategoria} movimientos sin categoría
            </Link>
            : clasifíquelos para afinar el número mínimo.
          </p>
        )}
      </Tarjeta>

      <EnlaceBoton href="/rapido" className="w-full">
        Registrar un gasto
      </EnlaceBoton>
    </div>
  );
}
