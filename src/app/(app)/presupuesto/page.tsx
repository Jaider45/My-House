import { AccionPrincipal, Barra, Chip, CuadroIcono, EnlaceBoton, Explicacion, Kpi, SelectorMes, TarjetaAcademia, Titulo, Vacio, cx, type Tono } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP, porcentaje } from "@/lib/dinero";
import { formatearMes, hoy, mesDe, rangoMes, sumarMeses } from "@/lib/fechas";
import { raizDe, type Categoria } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { montoMensual } from "@/lib/recurrentes";
import { filasPresupuesto, semaforo as semaforoTotal, type Semaforo } from "@/lib/presupuesto";
import { cargarPlan } from "@/lib/presupuesto/servidor";
import { cargarCatalogos } from "@/lib/catalogos";
import { tieneFuncion } from "@/lib/planes/servidor";
import Link from "next/link";
import type { TotalCategoria } from "@/lib/finanzas";
import { FormularioAgregarPresupuesto, FormularioPresupuesto } from "./formulario";
import { Ventana } from "@/components/ui/ventana";
import { PestanasPlanea } from "../pestanas-secciones";
import { BotonGuia } from "@/components/guia/boton-guia";
import { OfertaEnLugar, RecomendacionAcademia } from "@/components/ofertas-app";

export const metadata = { title: "Presupuesto" };

const SEMAFORO: Record<Semaforo, { tono: Tono & ("ok" | "alerta" | "error"); texto: string; barra: "ok" | "alerta" | "error" }> = {
  en_rango: { tono: "ok", texto: "En rango", barra: "ok" },
  atento: { tono: "alerta", texto: "Atento", barra: "alerta" },
  excedido: { tono: "error", texto: "Excedido", barra: "error" },
};

export default function Presupuesto({ searchParams }: PageProps<"/presupuesto">) {
  return (
    <Contenido searchParams={searchParams} />
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

  const [catalogos, { reglas: activas, presupuestos }, { data: filas }, conPronostico] = await Promise.all([
    cargarCatalogos(ctx),
    cargarPlan(ctx, mes, fecha),
    ctx.supabase.rpc("totales_por_categoria", { p_household: ctx.hogar.id, p_desde: rangoMes(sumarMeses(mes, -3)).desde, p_hasta: hasta }),
    tieneFuncion("metas"),
  ]);
  const categorias = catalogos.categorias as Categoria[];
  const reglas = activas.filter((r) => r.tipo === "gasto");
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const raiz = (id: string | null) => (id ? (raizDe(porId, id)?.id ?? id) : null);
  const raices = categorias.filter((c) => c.clase === "gasto" && !c.padre_id && !c.archivada && !c.excluir_de_costo_vida);

  type Suma = { fijos: number; adicional: number; real: number; programado: number; previos: number; pagos: { descripcion: string; mensual: number }[] };
  const suma = new Map<string, Suma>();
  const de = (id: string) => suma.get(id) ?? (suma.set(id, { fijos: 0, adicional: 0, real: 0, programado: 0, previos: 0, pagos: [] }), suma.get(id)!);
  for (const r of reglas) {
    const id = raiz(r.category_id);
    if (!id) continue;
    const mensual = montoMensual(r.monto, r.frecuencia);
    de(id).fijos += mensual;
    de(id).pagos.push({ descripcion: r.descripcion, mensual });
  }
  for (const p of presupuestos) de(p.category_id).adicional += p.monto;
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
            <BotonGuia id="presupuesto" />
            {ctx.puedeEditar && !editar && (
              <AccionPrincipal href={`/presupuesto?${mes !== mesActual ? `mes=${mes}&` : ""}nuevo=1`} guia="agregar-presupuesto">
                Agregar presupuesto
              </AccionPrincipal>
            )}
          </>
        }
      >
        {`Presupuesto de ${nombreMes}`}
      </Titulo>
      <PestanasPlanea activa="/presupuesto" />
      <OfertaEnLugar lugar="presupuesto" />

      {editar ? (
        <FormularioPresupuesto
          mes={mes}
          filas={raices
            .map((c) => {
              const x = de(c.id);
              return { id: c.id, nombre: c.nombre, icono: iconoCategoria(c.nombre), esencial: c.es_esencial, fijos: x.fijos, pagos: x.pagos, variable: x.adicional, promedio3: Math.round(x.previos / 3) };
            })
            .sort((a, b) => Number(b.esencial) - Number(a.esencial) || b.fijos + b.variable - (a.fijos + a.variable))}
          cancelar={
            <EnlaceBoton href={enlaceMes(mes)} variante="fantasma">
              Cancelar
            </EnlaceBoton>
          }
        />
      ) : lista.length === 0 ? (
        <Vacio icono="casa" titulo="Aún no hay presupuesto" acciones={ctx.puedeEditar ? <EnlaceBoton href={`/presupuesto?mes=${mes}&editar=1`}>Armar el presupuesto</EnlaceBoton> : undefined}>
          El presupuesto parte de tus pagos fijos (arriendo, servicios, colegio…) y le suma lo que quieras gastar en cada
          categoría. Carga tus pagos fijos en Pagos → Pagos fijos y aquí suma lo que quieras gastar en lo demás.
        </Vacio>
      ) : (
        <div className="space-y-4 md:space-y-5">
          <section aria-label="Resumen del presupuesto" className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
            <Kpi etiqueta="Presupuesto total" valor={formatearCOP(total.presupuesto)} detalle={`Fijos ${formatearCOP(total.fijos)} + variable ${formatearCOP(total.adicional)}`} />
            <Kpi
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
              etiqueta="Disponible"
              valor={formatearCOP(disponible)}
              detalle={mes === mesActual && diasRestantes > 0 && disponible > 0 ? `${formatearCOP(Math.floor(disponible / diasRestantes))} por día hasta el ${diasMes}` : "Lo que queda del presupuesto"}
            />
            <Kpi
              etiqueta="Pronóstico de cierre"
              valor={conPronostico ? formatearCOP(total.pronostico) : "Plan Familia"}
              detalle={!conPronostico ? <Link href="/ajustes/plan" className="font-semibold underline-offset-4 hover:underline">Ver planes</Link> :
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

          <div className="relative hidden overflow-x-auto rounded-2xl border border-borde bg-elevada md:block">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="der hidden 2xl:table-cell">Pagos fijos</th>
                  <th className="der hidden 2xl:table-cell">Variable</th>
                  <th className="der">Presupuesto</th>
                  <th className="der">Real</th>
                  <th className="der">Diferencia</th>
                  <th className="min-w-[150px]">Progreso</th>
                  <th className="der hidden 2xl:table-cell">Prom. 3 meses</th>
                  <th className="der">Pronóstico</th>
                  <th>Semáforo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className="inline-flex items-center gap-2 font-bold">
                        <CuadroIcono nombre={iconoCategoria(f.nombre)} tamano={28} tono={SEMAFORO[f.semaforo].tono} />
                        {f.nombre}
                      </span>
                    </td>
                    <td className="der hidden text-cuerpo 2xl:table-cell">{f.fijos ? formatearCOP(f.fijos) : "—"}</td>
                    <td className="der hidden text-cuerpo 2xl:table-cell">{f.adicional ? formatearCOP(f.adicional) : "—"}</td>
                    <td className="der font-semibold">{formatearCOP(f.presupuesto)}</td>
                    <td className="der">{formatearCOP(f.real)}</td>
                    <td className="der min-w-[150px] !whitespace-normal">
                      <b className={f.semaforo === "excedido" ? "text-error-tinta" : f.semaforo === "atento" ? "text-alerta-tinta" : "text-ok-tinta"}>
                        {f.diferencia < 0 ? `Te pasaste ${formatearCOP(-f.diferencia)}` : f.semaforo === "atento" ? `Quedan ${formatearCOP(f.diferencia)}, vas rápido` : `Quedan ${formatearCOP(f.diferencia)}`}
                      </b>
                      <span className="block text-[13px] text-tenue">{firmado(f.diferencia)}</span>
                    </td>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="flex-1">
                          <Barra porcentaje={f.porcentaje} tono={SEMAFORO[f.semaforo].barra} />
                        </span>
                        <span className="w-10 text-right text-[13px] text-cuerpo">{f.porcentaje} %</span>
                      </span>
                    </td>
                    <td className="der hidden text-cuerpo 2xl:table-cell">{formatearCOP(f.promedio3)}</td>
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
                  <td className="der hidden 2xl:table-cell">{formatearCOP(total.promedio3)}</td>
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
                  <CuadroIcono nombre={iconoCategoria(f.nombre)} tono={SEMAFORO[f.semaforo].tono} />
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
                  Fijos {formatearCOP(f.fijos)} · Variable {formatearCOP(f.adicional)} · Prom. 3 meses {formatearCOP(f.promedio3)} · Pronóstico {formatearCOP(f.pronostico)}
                </p>
              </section>
            ))}
            {ctx.puedeEditar && (
              <EnlaceBoton href={`/presupuesto?mes=${mes}&editar=1`} variante="secundario" className="w-full">
                Editar presupuesto
              </EnlaceBoton>
            )}
          </div>
          <Explicacion icono="educacion">
            <b>¿Cómo leer este presupuesto?</b> Verde: vas bien. Amarillo: a este ritmo te pasarás antes del {diasMes}. Rojo: ya te
            pasaste.{" "}
            <Link href="/academia/finanzas/presupuesto-que-se-cumple" className="font-bold underline">
              Aprende a armarlo en 4 minutos
            </Link>
          </Explicacion>
          <RecomendacionAcademia lugar="presupuesto" />
          <TarjetaAcademia
            href="/academia/finanzas"
            icono="educacion"
            etiqueta="Academia · Finanzas del hogar desde cero"
            titulo="Cómo armar un presupuesto que sí se cumple"
          />
        </div>
      )}

      {ctx.puedeEditar && !editar && (
        <Ventana titulo="Agregar presupuesto" subtitulo="Cuánto quieres gastar al mes en una categoría, además de sus pagos fijos." guia="form-presupuesto">
          <FormularioAgregarPresupuesto
            mes={mes}
            totalActual={total.presupuesto}
            categorias={raices
              .map((c) => {
                const x = de(c.id);
                return { id: c.id, nombre: c.nombre, variable: x.adicional, fijos: x.fijos, promedio3: Math.round(x.previos / 3) };
              })
              .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))}
          />
        </Ventana>
      )}

    </>
  );
}
