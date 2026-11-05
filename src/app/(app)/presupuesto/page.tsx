import { Suspense } from "react";
import { Barra, Boton, Cargando, Chip, CuadroIcono, EnlaceBoton, Kpi, SelectorMes, Titulo, Vacio, cx, type Tono } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP, formatearMiles, porcentaje } from "@/lib/dinero";
import { formatearMes, hoy, mesDe, rangoMes, sumarMeses } from "@/lib/fechas";
import { raizDe, type Categoria } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { montoMensual } from "@/lib/recurrentes";
import { filasPresupuesto, semaforo as semaforoTotal, type Semaforo } from "@/lib/presupuesto";
import type { TotalCategoria } from "@/lib/finanzas";
import { guardarPresupuesto } from "./acciones";

export const metadata = { title: "Presupuesto" };

const SEMAFORO: Record<Semaforo, { tono: Tono; texto: string; barra: "ok" | "alerta" | "error" }> = {
  en_rango: { tono: "ok", texto: "En rango", barra: "ok" },
  atento: { tono: "alerta", texto: "Atento", barra: "alerta" },
  excedido: { tono: "error", texto: "Excedido", barra: "error" },
};

export default function Presupuesto({ searchParams }: PageProps<"/presupuesto">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando el presupuesto…" />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}

const firmado = (n: number) => (n > 0 ? `+${formatearCOP(n)}` : n < 0 ? `−${formatearCOP(-n)}` : formatearCOP(0));

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const fecha = hoy();
  const mesActual = mesDe(fecha);
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual;
  const editar = sp.editar === "1" && ctx.puedeEditar;
  const { hasta } = rangoMes(mes);

  const [{ data: cats }, { data: reglas }, { data: presupuestos }, { data: filas }] = await Promise.all([
    ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
    ctx.supabase.from("recurring_rules").select("category_id, monto, frecuencia").eq("activa", true).eq("tipo", "gasto"),
    ctx.supabase.from("budgets_goals").select("category_id, monto").eq("tipo", "presupuesto"),
    ctx.supabase.rpc("totales_por_categoria", { p_household: ctx.hogar.id, p_desde: rangoMes(sumarMeses(mes, -3)).desde, p_hasta: hasta }),
  ]);
  const categorias = (cats ?? []) as Categoria[];
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const raiz = (id: string | null) => (id ? (raizDe(porId, id)?.id ?? id) : null);
  const raices = categorias.filter((c) => c.clase === "gasto" && !c.padre_id && !c.archivada && !c.excluir_de_costo_vida);

  const suma = new Map<string, { fijos: number; adicional: number; real: number; programado: number; previos: number }>();
  const de = (id: string) => suma.get(id) ?? (suma.set(id, { fijos: 0, adicional: 0, real: 0, programado: 0, previos: 0 }), suma.get(id)!);
  for (const r of reglas ?? []) {
    const id = raiz(r.category_id);
    if (id) de(id).fijos += montoMensual(r.monto, r.frecuencia);
  }
  for (const p of presupuestos ?? []) if (p.category_id) de(p.category_id).adicional += p.monto;
  for (const f of (filas ?? []) as TotalCategoria[]) {
    const id = raiz(f.category_id);
    if (!id || f.tipo !== "gasto") continue;
    if (f.mes.startsWith(mes)) de(id)[f.estado === "confirmado" ? "real" : "programado"] += f.total;
    else de(id).previos += f.total;
  }

  const diasMes = Number(hasta.slice(8));
  const dia = mes < mesActual ? diasMes : mes > mesActual ? 0 : Number(fecha.slice(8));
  const lista = filasPresupuesto(
    raices.map((c) => {
      const s = de(c.id);
      return { id: c.id, nombre: c.nombre, fijos: s.fijos, adicional: s.adicional, real: s.real, programado: s.programado, promedio3: Math.round(s.previos / 3) };
    }),
    dia,
    diasMes,
  );
  const total = lista.reduce(
    (t, f) => ({
      fijos: t.fijos + f.fijos,
      adicional: t.adicional + f.adicional,
      presupuesto: t.presupuesto + f.presupuesto,
      real: t.real + f.real,
      pronostico: t.pronostico + f.pronostico,
      promedio3: t.promedio3 + f.promedio3,
    }),
    { fijos: 0, adicional: 0, presupuesto: 0, real: 0, pronostico: 0, promedio3: 0 },
  );
  const estadoTotal = SEMAFORO[semaforoTotal(total.presupuesto, total.real, total.pronostico)];
  const disponible = total.presupuesto - total.real;
  const diasRestantes = Math.max(0, diasMes - dia);
  const nombreMes = formatearMes(mes).replace(/ de \d{4}$/, "");
  const enlaceMes = (m: string) => `/presupuesto?mes=${m}`;

  return (
    <>
      <Titulo
        subtitulo="Lo planeado por categoría contra lo que va del mes"
        accion={
          <>
            <SelectorMes etiqueta={formatearMes(mes).replace(" de ", " ")} anterior={enlaceMes(sumarMeses(mes, -1))} siguiente={enlaceMes(sumarMeses(mes, 1))} />
            {ctx.puedeEditar && !editar && (
              <span className="hidden md:contents">
                <EnlaceBoton href={`/presupuesto?mes=${mes}&editar=1`} variante="secundario">
                  Editar presupuesto
                </EnlaceBoton>
              </span>
            )}
          </>
        }
      >
        {`Presupuesto de ${nombreMes}`}
      </Titulo>

      {lista.length === 0 ? (
        <Vacio icono="casa" titulo="Aún no hay presupuesto" acciones={<EnlaceBoton href={`/presupuesto?mes=${mes}&editar=1`}>Armar el presupuesto</EnlaceBoton>}>
          El presupuesto parte de tus pagos fijos y le suma lo que quieras gastar en cada categoría.
        </Vacio>
      ) : editar ? (
        <form action={guardarPresupuesto} className="space-y-4">
          <input type="hidden" name="mes" value={mes} />
          <p className="text-sm text-cuerpo">
            Los pagos fijos ya cuentan solos. Escribe el adicional del mes para cada categoría (deja 0 para no presupuestar
            más).
          </p>
          <div className="overflow-hidden rounded-2xl border border-borde bg-elevada">
            {raices.map((c) => {
              const s = de(c.id);
              return (
                <label key={c.id} className="flex flex-wrap items-center gap-3 border-b border-divisor px-4 py-3 last:border-b-0 md:px-6">
                  <CuadroIcono nombre={iconoCategoria(c.nombre)} />
                  <span className="flex min-w-0 flex-[1_1_160px] flex-col">
                    <b className="text-[15px]">{c.nombre}</b>
                    <span className="text-[13px] text-tenue">Fijos {formatearCOP(s.fijos)}</span>
                  </span>
                  <span className="flex items-center gap-2 rounded-lg border border-control bg-elevada px-3">
                    <span className="text-cuerpo">$</span>
                    <input
                      name={`adicional:${c.id}`}
                      inputMode="numeric"
                      defaultValue={s.adicional ? formatearMiles(s.adicional) : ""}
                      placeholder="0"
                      aria-label={`Adicional de ${c.nombre}`}
                      className="h-11 w-32 bg-transparent text-right text-[15px] outline-none"
                    />
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <Boton type="submit">Guardar presupuesto</Boton>
            <EnlaceBoton href={enlaceMes(mes)} variante="fantasma">
              Cancelar
            </EnlaceBoton>
          </div>
        </form>
      ) : (
        <div className="space-y-4 md:space-y-5">
          <section aria-label="Resumen del presupuesto" className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
            <Kpi icono="casa" etiqueta="Presupuesto total" valor={formatearCOP(total.presupuesto)} detalle={`Fijos ${formatearCOP(total.fijos)} + adicional ${formatearCOP(total.adicional)}`} />
            <Kpi
              icono="egresos"
              etiqueta="Gastado a la fecha"
              valor={formatearCOP(total.real)}
              detalle={
                <span className="flex flex-col gap-1.5">
                  <Barra porcentaje={porcentaje(total.real, total.presupuesto)} tono="marca" />
                  {porcentaje(total.real, total.presupuesto)} % del presupuesto{mes === mesActual ? ` · día ${dia} de ${diasMes}` : ""}
                </span>
              }
            />
            <Kpi
              icono="ahorro"
              etiqueta="Disponible"
              valor={formatearCOP(disponible)}
              detalle={mes === mesActual && diasRestantes > 0 && disponible > 0 ? `${formatearCOP(Math.floor(disponible / diasRestantes))} por día hasta el ${diasMes}` : "Lo que queda del presupuesto"}
            />
            <Kpi
              icono="resumen"
              etiqueta="Pronóstico de cierre"
              valor={formatearCOP(total.pronostico)}
              detalle={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <Chip tono={estadoTotal.tono}>{estadoTotal.texto}</Chip>
                  {total.pronostico > total.presupuesto ? `${formatearCOP(total.pronostico - total.presupuesto)} sobre el presupuesto` : `${formatearCOP(total.presupuesto - total.pronostico)} por debajo`}
                </span>
              }
            />
          </section>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-cuerpo" aria-label="Semáforo">
            <span className="inline-flex items-center gap-1.5">
              <Chip tono="ok">En rango</Chip> gasto y pronóstico dentro del presupuesto
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Chip tono="alerta">Atento</Chip> el pronóstico lo supera
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Chip tono="error">Excedido</Chip> el gasto ya lo superó
            </span>
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-borde bg-elevada md:block">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="der hidden 2xl:table-cell">Fijos programados</th>
                  <th className="der hidden 2xl:table-cell">Adicional</th>
                  <th className="der">Presupuesto</th>
                  <th className="der">Real</th>
                  <th className="der">Diferencia</th>
                  <th className="min-w-[150px]">Progreso</th>
                  <th className="der hidden lg:table-cell">Prom. 3 meses</th>
                  <th className="der">Pronóstico</th>
                  <th>Semáforo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className="inline-flex items-center gap-2 font-bold">
                        <CuadroIcono nombre={iconoCategoria(f.nombre)} tamano={28} />
                        {f.nombre}
                      </span>
                    </td>
                    <td className="der hidden text-cuerpo xl:table-cell">{f.fijos ? formatearCOP(f.fijos) : "—"}</td>
                    <td className="der hidden text-cuerpo xl:table-cell">{f.adicional ? formatearCOP(f.adicional) : "—"}</td>
                    <td className="der font-semibold">{formatearCOP(f.presupuesto)}</td>
                    <td className="der">{formatearCOP(f.real)}</td>
                    <td className={cx("der", f.diferencia < 0 ? "font-semibold text-error-tinta" : "text-cuerpo")}>{firmado(f.diferencia)}</td>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="flex-1">
                          <Barra porcentaje={f.porcentaje} tono={SEMAFORO[f.semaforo].barra} />
                        </span>
                        <span className="w-10 text-right text-[13px] text-cuerpo">{f.porcentaje} %</span>
                      </span>
                    </td>
                    <td className="der hidden text-cuerpo lg:table-cell">{formatearCOP(f.promedio3)}</td>
                    <td className="der">{formatearCOP(f.pronostico)}</td>
                    <td>
                      <Chip tono={SEMAFORO[f.semaforo].tono}>{SEMAFORO[f.semaforo].texto}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-mosaico font-bold [&>td]:border-t [&>td]:border-borde">
                  <td>Total</td>
                  <td className="der hidden 2xl:table-cell">{formatearCOP(total.fijos)}</td>
                  <td className="der hidden 2xl:table-cell">{formatearCOP(total.adicional)}</td>
                  <td className="der">{formatearCOP(total.presupuesto)}</td>
                  <td className="der">{formatearCOP(total.real)}</td>
                  <td className="der">{firmado(disponible)}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className="flex-1">
                        <Barra porcentaje={porcentaje(total.real, total.presupuesto)} tono="marca" />
                      </span>
                      <span className="w-10 text-right text-[13px] text-cuerpo">{porcentaje(total.real, total.presupuesto)} %</span>
                    </span>
                  </td>
                  <td className="der hidden lg:table-cell">{formatearCOP(total.promedio3)}</td>
                  <td className="der">{formatearCOP(total.pronostico)}</td>
                  <td>
                    <Chip tono={estadoTotal.tono}>{estadoTotal.texto}</Chip>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-col gap-2.5 md:hidden">
            {lista.map((f) => (
              <section key={f.id} className="flex flex-col gap-2.5 rounded-2xl border border-borde bg-elevada p-4">
                <div className="flex items-center gap-3">
                  <CuadroIcono nombre={iconoCategoria(f.nombre)} />
                  <b className="min-w-0 flex-1 truncate text-[15px]">{f.nombre}</b>
                  <Chip tono={SEMAFORO[f.semaforo].tono}>{SEMAFORO[f.semaforo].texto}</Chip>
                </div>
                <Barra porcentaje={f.porcentaje} tono={SEMAFORO[f.semaforo].barra} gruesa />
                <div className="flex justify-between gap-2 text-sm">
                  <span>
                    <b>{formatearCOP(f.real)}</b> <span className="text-cuerpo">de {formatearCOP(f.presupuesto)}</span>
                  </span>
                  <span className={cx("font-semibold", f.diferencia < 0 ? "text-error-tinta" : "text-cuerpo")}>
                    {f.diferencia < 0 ? `Pasado por ${formatearCOP(-f.diferencia)}` : `Quedan ${formatearCOP(f.diferencia)}`}
                  </span>
                </div>
                <p className="text-[13px] text-cuerpo">
                  Fijos {formatearCOP(f.fijos)} · Prom. 3 meses {formatearCOP(f.promedio3)} · Pronóstico {formatearCOP(f.pronostico)}
                </p>
              </section>
            ))}
            {ctx.puedeEditar && (
              <EnlaceBoton href={`/presupuesto?mes=${mes}&editar=1`} variante="secundario" className="w-full">
                Editar presupuesto
              </EnlaceBoton>
            )}
          </div>
        </div>
      )}
    </>
  );
}
