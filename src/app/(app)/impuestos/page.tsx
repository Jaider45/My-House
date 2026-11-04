import Link from "next/link";
import { Suspense } from "react";
import { Aviso, Cargando, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { cargarSemaforo, COLOR_SEMAFORO } from "@/lib/impuestos/servidor";

export const metadata = { title: "Semáforo DIAN" };

export default function Impuestos({ searchParams }: PageProps<"/impuestos">) {
  return (
    <>
      <Titulo>Semáforo DIAN</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const anioActual = Number(hoy().slice(0, 4));
  const anio = typeof sp.anio === "string" && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : anioActual;

  const [semaforo, { data: anios }, { data: etiquetados }] = await Promise.all([
    cargarSemaforo(ctx, anio),
    ctx.supabase.from("tax_params").select("anio").eq("pais", ctx.hogar.pais).order("anio", { ascending: false }),
    ctx.supabase
      .from("transactions")
      .select("monto, tipo, tax_tags(nombre)")
      .not("tax_tag_id", "is", null)
      .eq("estado", "confirmado")
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`),
  ]);

  const porEtiqueta = new Map<string, number>();
  for (const t of etiquetados ?? []) {
    const nombre = t.tax_tags?.nombre ?? "Otra";
    porEtiqueta.set(nombre, (porEtiqueta.get(nombre) ?? 0) + t.monto);
  }

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {(anios ?? []).map(({ anio: a }) => (
          <Link
            key={a}
            href={`/impuestos?anio=${a}`}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${a === anio ? "bg-white shadow dark:bg-zinc-800" : "text-zinc-500"}`}
          >
            {a}
          </Link>
        ))}
      </nav>

      {!semaforo.ok ? (
        <Aviso tipo="info">{semaforo.motivo}</Aviso>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            Acumulado de {anio} de cada persona contra los topes para declarar renta. {semaforo.jurisdiccion.unidad} {anio}:{" "}
            {formatearCOP(semaforo.params.uvt_valor)}. Si alcanza cualquiera de los topes, la persona debe declarar en {anio + 1}.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            {(["verde", "amarillo", "rojo"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`size-2.5 rounded-full ${COLOR_SEMAFORO[s].punto}`} /> {COLOR_SEMAFORO[s].texto}
              </span>
            ))}
          </div>

          {semaforo.personas.length === 0 && <Vacio>No hay personas adultas en el hogar.</Vacio>}
          {semaforo.personas.map((p) => (
            <Tarjeta
              key={p.member_id}
              titulo={
                <span className="flex items-center gap-2">
                  <span className={`size-3 rounded-full ${COLOR_SEMAFORO[p.estado].punto}`} aria-hidden />
                  {p.nombre}
                </span>
              }
              accion={<span className="text-xs text-zinc-500">{COLOR_SEMAFORO[p.estado].texto}</span>}
            >
              <ul className="space-y-3">
                {p.topes.map((t) => (
                  <li key={t.clave} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{t.nombre}</span>
                      <span className="font-semibold tabular-nums">{t.porcentaje} %</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className={`h-full rounded-full ${COLOR_SEMAFORO[t.semaforo].barra}`} style={{ width: `${Math.min(100, t.porcentaje)}%` }} />
                    </div>
                    <p className="text-xs text-zinc-500">
                      {formatearCOP(t.acumulado)} de {formatearCOP(t.tope)} ({t.topeUnidades.toLocaleString("es-CO")} {semaforo.jurisdiccion.unidad}) · {t.ayuda}
                    </p>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ))}

          <Aviso tipo="info">
            Se atribuye cada movimiento a la persona elegida en él o, si no, al titular de la cuenta. Asigne titular a
            cada cuenta en <Link href="/cuentas" className="underline">Cuentas</Link>. El semáforo es una guía; confirme
            con su contador.
          </Aviso>
        </>
      )}

      <Tarjeta titulo={`Para la declaración ${anio}`}>
        {porEtiqueta.size ? (
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {[...porEtiqueta.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([nombre, total]) => (
                <li key={nombre} className="flex justify-between py-2">
                  <span>{nombre}</span>
                  <span className="tabular-nums">{formatearCOP(total)}</span>
                </li>
              ))}
          </ul>
        ) : (
          <Vacio>Marque movimientos con una etiqueta DIAN (medicina prepagada, intereses de vivienda…) en «Más detalles».</Vacio>
        )}
      </Tarjeta>
    </div>
  );
}
