import Link from "next/link";
import { Aviso, Barra, Chip, CuadroIcono, EnlaceBoton, FilaLista, Kpi, SelectorMes, Tarjeta, Titulo, Vacio, cx } from "@/components/ui";
import { Icono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP, formatearCorto, porcentaje } from "@/lib/dinero";
import { formatearDia, formatearMes, hoy, mesDe, rangoMes, sumarDias, sumarMeses } from "@/lib/fechas";
import { resumirMes, type TotalCategoria } from "@/lib/finanzas";
import type { Categoria } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { cargarSemaforo, type SemaforoAnio } from "@/lib/impuestos/servidor";
import { cargarPlan } from "@/lib/presupuesto/servidor";
import { fechasEnRango } from "@/lib/recurrentes";

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <Tablero searchParams={searchParams} />
  );
}

const veces = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nombreMes = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });
const etiquetaMesCorto = (mes: string) => {
  const t = nombreMes.format(new Date(`${mes}-01T00:00:00Z`)).replace(".", "");
  return t.charAt(0).toUpperCase() + t.slice(1, 3);
};

async function Tablero({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const hoyISO = hoy();
  const mesActual = mesDe(hoyISO);
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual;
  const { desde, hasta } = rangoMes(mes);

  const anio = Number(mesActual.slice(0, 4));
  const [{ data: filas }, { data: categorias }, { count: personas }, { count: cuentas }, { plan, reglas }, { count: sinCategoria }, { data: programados }, semaforo] =
    await Promise.all([
      ctx.supabase.rpc("totales_por_categoria", { p_household: ctx.hogar.id, p_desde: rangoMes(sumarMeses(mes, -11)).desde, p_hasta: hasta }),
      ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
      ctx.supabase.from("members").select("id", { count: "exact", head: true }),
      ctx.supabase.from("accounts").select("id", { count: "exact", head: true }),
      cargarPlan(ctx, mes, hoyISO),
      ctx.supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .neq("tipo", "transferencia")
        .is("category_id", null)
        .gte("fecha", desde)
        .lte("fecha", hasta),
      ctx.supabase
        .from("transactions")
        .select("id, fecha, monto, comercio, category_id")
        .eq("tipo", "gasto")
        .eq("estado", "programado")
        .lte("fecha", sumarDias(hoyISO, 15))
        .order("fecha")
        .limit(6),
      cargarSemaforo(ctx, anio),
    ]);

  const todas = (filas ?? []) as TotalCategoria[];
  const cats = (categorias ?? []) as Categoria[];
  // El plan (pagos fijos y presupuesto) solo aplica al mes en curso: los meses cerrados se miden con lo real.
  const conPlan = mes >= mesActual;
  const r = resumirMes({
    mes,
    filas: todas,
    categorias: cats,
    personas: personas ?? 1,
    cuotaImprevistosPct: ctx.hogar.cuotaImprevistosPct,
    plan: conPlan ? plan : undefined,
  });
  const porId = new Map(cats.map((c) => [c.id, c]));
  // Próximos pagos: lo ya programado + lo que las reglas programarán en los próximos 15 días.
  const limite = sumarDias(hoyISO, 15);
  const pendientes = [
    ...(programados ?? []).map((p) => ({ clave: p.id, fecha: p.fecha, monto: p.monto, nombre: p.comercio, category_id: p.category_id })),
    ...reglas
      .filter((g) => g.tipo === "gasto")
      .flatMap((g) =>
        fechasEnRango(g.fecha_inicio, g.frecuencia, g.ocurrencias, hoyISO, limite).map((f) => ({ clave: `${g.id}-${f}`, fecha: f, monto: g.monto, nombre: g.descripcion, category_id: g.category_id })),
      ),
  ]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);
  const titulo = `Resumen de ${formatearMes(mes).replace(/ de \d{4}$/, "")}`;
  const encabezado = (
    <Titulo
      subtitulo="Cuánto cuesta sostener la casa este mes"
      accion={<SelectorMes etiqueta={formatearMes(mes).replace(" de ", " ")} anterior={`/?mes=${sumarMeses(mes, -1)}`} siguiente={mes < mesActual ? `/?mes=${sumarMeses(mes, 1)}` : undefined} />}
    >
      {titulo}
    </Titulo>
  );

  if (r.ingresos + r.gastos + r.porPagar + r.costoVida === 0) {
    const pasos = [
      { icono: "cuentas", titulo: "Crea tus cuentas", detalle: "Banco, efectivo, tarjetas", hecho: (cuentas ?? 0) > 0, href: "/cuentas" },
      { icono: "calendario", titulo: "Carga tus pagos fijos", detalle: "Arriendo, servicios, colegio, créditos", hecho: reglas.length > 0, href: "/presupuesto" },
      { icono: "egresos", titulo: "Registra tu primer gasto", detalle: "Toma menos de 10 segundos", hecho: false, href: "/rapido" },
      { icono: "familia", titulo: "Invita a tu pareja", detalle: "Registren juntos, vean lo mismo", hecho: (personas ?? 0) > 1, href: "/ajustes/miembros" },
    ] as const;
    return (
      <>
        {encabezado}
        <div className="space-y-4 md:space-y-5">
          <Vacio
            icono="resumen"
            titulo={`Tu resumen de ${formatearMes(mes).replace(/ de \d{4}$/, "")} está vacío`}
            acciones={
              <>
                <EnlaceBoton href={cuentas ? "/rapido" : "/cuentas"}>{cuentas ? "Registrar un gasto" : "Crear una cuenta"}</EnlaceBoton>
                <EnlaceBoton href="/importar" variante="secundario">
                  Importar extracto CSV
                </EnlaceBoton>
              </>
            }
          >
            Registra tu primer gasto o importa el extracto del banco. Con tus pagos fijos cargados, My House calcula el número mínimo del hogar.
          </Vacio>
          <Tarjeta>
            <p className="mb-2 text-xs leading-4 font-bold tracking-[0.12em] uppercase">Primeros pasos</p>
            {pasos.map((p) => (
              <Link key={p.titulo} href={p.href} className="block">
                <FilaLista icono={p.icono} titulo={p.titulo} detalle={p.detalle} valor={<Chip tono={p.hecho ? "ok" : "neutro"}>{p.hecho ? "Hecho" : "Pendiente"}</Chip>} />
              </Link>
            ))}
          </Tarjeta>
        </div>
      </>
    );
  }

  const cantidadIngresos = todas.filter((f) => f.mes.startsWith(mes) && f.tipo === "ingreso" && f.estado === "confirmado").reduce((s, f) => s + (f.cantidad ?? 0), 0);
  const previsto = r.costoVida + r.ahorro;
  const vencidos = pendientes.filter((p) => p.fecha < hoyISO).length;
  const nombreDelMes = formatearMes(mes).replace(/ de \d{4}$/, "");

  return (
    <>
      {encabezado}
      <div className="space-y-4 md:space-y-5">
        <section aria-label="Indicadores del mes" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          <Kpi
            icono="ingresos"
            etiqueta="Ingresos del mes"
            valor={formatearCOP(r.ingresos)}
            detalle={
              r.ingresosEsperados > r.ingresos
                ? `De ${formatearCOP(r.ingresosEsperados)} esperados`
                : `${cantidadIngresos} ${cantidadIngresos === 1 ? "ingreso registrado" : "ingresos registrados"}`
            }
          />
          <Kpi
            icono="egresos"
            etiqueta="Gastos del mes"
            valor={formatearCOP(r.gastos)}
            detalle={
              previsto ? (
                <span className="flex flex-col gap-1.5">
                  <Barra porcentaje={porcentaje(r.gastos, previsto)} tono="marca" />
                  {porcentaje(r.gastos, previsto)} % de los {formatearCOP(previsto)} previstos
                </span>
              ) : (
                "Sin gastos previstos"
              )
            }
          />
          <Kpi
            icono="calendario"
            etiqueta="Pagos fijos pendientes"
            valor={formatearCOP(r.porPagar)}
            detalle={
              r.pagosPorPagar
                ? `${r.pagosPorPagar} ${r.pagosPorPagar === 1 ? "pago" : "pagos"} por hacer${vencidos ? ` · ${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}` : ""}`
                : "Todo pagado este mes"
            }
          />
          <Kpi
            icono="ahorro"
            etiqueta={conPlan ? "Ahorro proyectado" : "Ahorro del mes"}
            valor={r.ingresosEsperados ? formatearCOP(r.ahorroProyectado) : "—"}
            detalle={
              !r.ingresosEsperados
                ? conPlan
                  ? "Agrega tu salario como ingreso fijo para proyectarlo"
                  : "Sin ingresos registrados"
                : r.ahorroProyectado < 0
                  ? "El costo de vida supera los ingresos"
                  : `${porcentaje(r.ahorroProyectado, r.ingresosEsperados)} % de los ingresos`
            }
          />
          <Kpi
            clave
            icono="casa"
            etiqueta="Número mínimo del hogar"
            valor={formatearCOP(r.numeroMinimo.total)}
            detalle={
              r.ingresosEsperados && r.numeroMinimo.total
                ? `Tus ingresos lo cubren ${veces.format(r.ingresosEsperados / r.numeroMinimo.total)} veces`
                : "Lo que la casa necesita sí o sí"
            }
          />
          <Kpi
            icono="familia"
            etiqueta="Costo de vida"
            valor={formatearCOP(r.costoVida)}
            detalle={`${formatearCOP(r.costoPorPersona)} por persona · ${personas ?? 1} en el hogar`}
          />
        </section>

        {conPlan && !reglas.some((g) => g.tipo === "gasto") && ctx.puedeEditar && (
          <Aviso tipo="info">
            Aún no tienes pagos fijos: el costo de vida solo cuenta lo que registras.{" "}
            <Link href="/presupuesto" className="font-semibold underline">
              Carga el arriendo, los servicios y demás en Presupuesto
            </Link>{" "}
            para verlo completo desde el primer día del mes.
          </Aviso>
        )}

        <AvisoDian semaforo={semaforo} />

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          <Tarjeta
            className="lg:col-span-2"
            titulo="Ingresos contra gastos"
            subtitulo="Últimos 12 meses"
            accion={
              <div className="flex flex-wrap gap-4 text-[13px] text-cuerpo">
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-3 rounded-[3px] bg-monte" />
                  Ingresos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-3 rounded-[3px] bg-teja" />
                  Gastos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="rayado-teja size-3 rounded-[3px]" />
                  Programados
                </span>
              </div>
            }
          >
            <Grafico filas={todas} mes={mes} />
          </Tarjeta>

          <Tarjeta titulo="Próximos pagos" subtitulo="Lo programado para los próximos 15 días">
            {pendientes.length ? (
              pendientes.map((p) => {
                const cat = p.category_id ? porId.get(p.category_id) : undefined;
                return (
                  <FilaLista
                    key={p.clave}
                    icono={iconoCategoria(cat?.nombre ?? p.nombre)}
                    titulo={p.nombre || cat?.nombre || "Pago programado"}
                    detalle={p.fecha < hoyISO ? `Vencido · ${formatearDia(p.fecha)}` : `Vence el ${formatearDia(p.fecha)}`}
                    valor={formatearCOP(p.monto)}
                  />
                );
              })
            ) : (
              <p className="py-4 text-sm text-tenue">No hay pagos programados en los próximos días.</p>
            )}
            <Link href="/recurrentes" className="mt-3 inline-flex h-9 items-center text-sm font-semibold hover:underline">
              Ver todos los pagos fijos →
            </Link>
          </Tarjeta>
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          <Tarjeta
            className="lg:col-span-2"
            titulo={`Costo de vida de ${nombreDelMes}`}
            subtitulo={conPlan ? "Por categoría: lo presupuestado, o lo gastado si ya lo superaste" : "Lo que se gastó en cada categoría"}
            accion={
              <EnlaceBoton href={conPlan ? "/presupuesto" : `/movimientos?mes=${mes}`} variante="secundario" className="h-9 px-3 text-sm">
                {conPlan ? "Ajustar presupuesto" : "Ver movimientos"}
              </EnlaceBoton>
            }
          >
            {r.esperadoPorCategoria.length ? (
              <ul>
                {r.esperadoPorCategoria.slice(0, 7).map((c) => {
                  const cat = c.id ? porId.get(c.id) : undefined;
                  const avance = conPlan ? porcentaje(c.comprometido, c.esperado) : porcentaje(c.esperado, r.costoVida);
                  return (
                    <li key={c.id ?? "sin"} className="border-b border-divisor last:border-b-0">
                      <Link
                        href={c.id ? `/movimientos?mes=${mes}&categoria=${c.id}` : `/movimientos?mes=${mes}&categoria=sin`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(180px,1.2fr)_minmax(0,2fr)_190px_96px] md:gap-4"
                      >
                        <span className="flex min-w-0 items-center gap-3 text-[15px] font-semibold">
                          <CuadroIcono nombre={iconoCategoria(c.nombre)} />
                          <span className="truncate">{c.nombre}</span>
                        </span>
                        <span className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                          <Barra porcentaje={avance} tono={c.esencial ? "marca" : "teja"} gruesa />
                        </span>
                        <span className="row-start-3 text-sm text-cuerpo md:row-start-auto md:text-right">
                          {conPlan ? (
                            <>
                              <b className="text-tinta">{formatearCOP(c.esperado)}</b> · llevas {formatearCorto(c.comprometido)}
                            </>
                          ) : (
                            <>
                              <b className="text-tinta">{formatearCOP(c.esperado)}</b> · {avance} %
                            </>
                          )}
                        </span>
                        <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
                          <Chip tono={c.esencial ? "info" : "neutro"}>{!cat ? "Sin categoría" : c.esencial ? "Esencial" : "No esencial"}</Chip>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-tenue">Sin gastos ni presupuesto en este mes.</p>
            )}
            {r.esperadoPorCategoria.length > 7 && (
              <p className="mt-2 text-[13px] text-tenue">
                Y {r.esperadoPorCategoria.length - 7} categorías más en{" "}
                <Link href="/presupuesto" className="font-semibold underline">
                  Presupuesto
                </Link>
                .
              </p>
            )}
            {(sinCategoria ?? 0) > 0 && (
              <div className="mt-3">
                <Aviso tipo="info">
                  <Link href={`/movimientos?mes=${mes}&categoria=sin`} className="font-semibold underline">
                    {sinCategoria} movimientos sin categoría
                  </Link>
                  : clasifícalos para afinar el número mínimo.
                </Aviso>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Número mínimo del hogar" subtitulo="Lo que la casa necesita cada mes sí o sí">
            <dl className="text-[15px]">
              {[
                ["Pagos fijos esenciales", r.numeroMinimo.fijos],
                [
                  r.numeroMinimo.mesesPromedio
                    ? `Variables esenciales (presupuesto o promedio de ${r.numeroMinimo.mesesPromedio} ${r.numeroMinimo.mesesPromedio === 1 ? "mes" : "meses"})`
                    : "Variables esenciales (presupuesto o este mes)",
                  r.numeroMinimo.variablesEsenciales,
                ],
                [`Imprevistos (${ctx.hogar.cuotaImprevistosPct} %)`, r.numeroMinimo.imprevistos],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="flex justify-between gap-3 border-b border-divisor py-2.5">
                  <dt className="text-cuerpo">{etiqueta}</dt>
                  <dd className="font-semibold whitespace-nowrap">{formatearCOP(valor as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-3 text-base font-bold">
                <dt>Número mínimo</dt>
                <dd className="whitespace-nowrap">{formatearCOP(r.numeroMinimo.total)}</dd>
              </div>
            </dl>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-cuerpo">Esenciales del costo de vida</span>
                <span className="font-semibold">{porcentaje(r.costoEsencial, r.costoVida)} %</span>
              </div>
              <Barra porcentaje={porcentaje(r.costoEsencial, r.costoVida)} tono="marca" />
              <div className="flex justify-between pt-1">
                <span className="text-cuerpo">Pagos fijos del costo de vida</span>
                <span className="font-semibold">{porcentaje(r.fijos, r.costoVida)} %</span>
              </div>
              <Barra porcentaje={porcentaje(r.fijos, r.costoVida)} tono="teja" />
            </div>
            <details className="group mt-5 rounded-xl bg-mosaico px-4 py-3 text-[13px] leading-5 text-cuerpo">
              <summary className="cursor-pointer list-none font-semibold text-tinta">
                ¿Cómo se calcula? <span className="text-tenue group-open:hidden">Ver</span>
              </summary>
              <ul className="mt-2 list-disc space-y-1.5 pl-4">
                <li>
                  <b>Costo de vida</b>: por cada categoría, lo presupuestado (pagos fijos + gasto variable) o lo que ya gastaste si es
                  más. No incluye «Ahorro e inversión».
                </li>
                <li>
                  <b>Número mínimo</b>: solo categorías esenciales. En cada una, lo mayor entre lo presupuestado y lo que sueles
                  gastar (promedio de los últimos 3 meses), más la cuota de imprevistos.
                </li>
                <li>
                  <b>Ahorro proyectado</b>: ingresos esperados (los recibidos o tus ingresos fijos, lo mayor) menos el costo de vida.
                </li>
                <li>Los meses cerrados se miden con lo que realmente pasó.</li>
              </ul>
            </details>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

/** Aviso de Renta: quien ya alcanzó un tope (rojo) o está cerca (amarillo). */
function AvisoDian({ semaforo }: { semaforo: SemaforoAnio }) {
  if (!semaforo.ok || !semaforo.personas.length) return null;
  const peor = (["rojo", "amarillo", "verde"] as const).find((e) => semaforo.personas.some((p) => p.estado === e))!;
  const afectadas = semaforo.personas.filter((p) => p.estado === peor);
  const otras = semaforo.personas.filter((p) => p.estado !== peor);
  const mayor = (p: (typeof afectadas)[number]) => p.topes.reduce((a, b) => (b.porcentaje > a.porcentaje ? b : a));
  const lista = (ps: { nombre: string }[]) => ps.map((p) => p.nombre).join(" y ");
  const t = mayor(afectadas[0]);

  const contenido = {
    rojo: {
      titulo: `Renta ${semaforo.anio}: ${lista(afectadas)} ${afectadas.length > 1 ? "deberán" : "deberá"} declarar en ${semaforo.anio + 1}`,
      texto: `${t.nombre}: ${formatearCOP(t.acumulado)}, sobre el tope de ${formatearCOP(t.tope)} (${t.topeUnidades.toLocaleString("es-CO")} ${semaforo.jurisdiccion.unidad}).${otras.length ? ` ${lista(otras)} ${otras.length > 1 ? "siguen" : "sigue"} bajo los topes.` : ""}`,
      clases: "bg-error-fondo text-error-tinta",
    },
    amarillo: {
      titulo: `Renta ${semaforo.anio}: ${lista(afectadas)} ${afectadas.length > 1 ? "están" : "está"} cerca de un tope`,
      texto: `${t.nombre} va en el ${t.porcentaje} % del tope de ${formatearCOP(t.tope)}. Revisa los soportes con tiempo.`,
      clases: "bg-alerta-fondo text-alerta-tinta",
    },
    verde: {
      titulo: `Renta ${semaforo.anio}: nadie del hogar está cerca de los topes`,
      texto: "My House sigue los acumulados del año con cada movimiento que registras.",
      clases: "bg-ok-fondo text-ok-tinta",
    },
  }[peor];

  return (
    <section aria-label="Estado DIAN" className={cx("flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4", contenido.clases)}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
        <Icono nombre="declaracion-renta" tamano={22} acento={false} />
      </span>
      <div className="min-w-0 flex-[1_1_320px]">
        <strong className="block text-base leading-[22px]">{contenido.titulo}</strong>
        <span className="text-sm">{contenido.texto}</span>
      </div>
      <EnlaceBoton href="/impuestos" variante="secundario" className="h-9 border-current! bg-transparent! px-3 text-sm text-current!">
        Ver Renta DIAN
      </EnlaceBoton>
    </section>
  );
}

/** Barras de ingresos y gastos de 12 meses; los gastos programados se apilan rayados sobre los confirmados. */
function Grafico({ filas, mes }: { filas: TotalCategoria[]; mes: string }) {
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(mes, i - 11));
  const datos = meses.map((m) => {
    const delMes = filas.filter((f) => f.mes.startsWith(m));
    const suma = (tipo: string, estado: string) => delMes.filter((f) => f.tipo === tipo && f.estado === estado).reduce((s, f) => s + f.total, 0);
    return { m, ingresos: suma("ingreso", "confirmado"), gastos: suma("gasto", "confirmado"), programados: suma("gasto", "programado") };
  });
  const maximo = Math.max(...datos.map((d) => Math.max(d.ingresos, d.gastos + d.programados)), 1);
  // Tope del eje redondeado hacia arriba a un paso "bonito" (1, 2 o 5 × 10^n) para que las 3 divisiones lean bien.
  const base = 10 ** Math.floor(Math.log10(maximo / 3));
  const paso = [1, 2, 5, 10].map((k) => k * base).find((p) => p * 3 >= maximo)!;
  const tope = paso * 3;
  const alto = (v: number) => `${((v / tope) * 100).toFixed(1)}%`;
  const descripcion = datos.filter((d) => d.ingresos >= d.gastos + d.programados).length;

  return (
    <div
      className="flex h-[190px] gap-1.5 md:h-60 md:gap-3"
      role="img"
      aria-label={`Gráfico de barras de ingresos y gastos de los últimos 12 meses. Los ingresos cubren los gastos en ${descripcion} de 12 meses.`}
    >
      <div className="flex w-[30px] shrink-0 flex-col justify-between pb-6 text-right text-[11px] text-tenue md:w-11 md:text-xs">
        {[3, 2, 1, 0].map((k) => (
          <span key={k}>{formatearCorto(paso * k)}</span>
        ))}
      </div>
      <div className="relative grid flex-1 grid-cols-12 gap-0.5 border-b border-borde bg-[linear-gradient(var(--color-divisor)_1px,transparent_1px)] bg-[length:100%_33.33%] md:gap-1.5">
        {datos.map((d) => (
          <div key={d.m} className="flex min-w-0 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-[3px]">
              <div className="w-[42%] max-w-[18px] rounded-t bg-monte" style={{ height: alto(d.ingresos) }} title={`Ingresos ${formatearCOP(d.ingresos)}`} />
              <div className="flex w-[42%] max-w-[18px] flex-col justify-end" style={{ height: alto(d.gastos + d.programados) }} title={`Gastos ${formatearCOP(d.gastos + d.programados)}`}>
                {d.programados > 0 && <div className="rayado-teja rounded-t" style={{ height: `${(d.programados / (d.gastos + d.programados)) * 100}%` }} />}
                <div className={cx("bg-teja", d.programados > 0 ? "" : "rounded-t")} style={{ height: `${(d.gastos / Math.max(1, d.gastos + d.programados)) * 100}%` }} />
              </div>
            </div>
            <div className="-mb-6 h-[18px] text-[11px] text-cuerpo md:text-xs">{etiquetaMesCorto(d.m)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
