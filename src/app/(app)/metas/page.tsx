import Link from "next/link";
import { AccionPrincipal, Barra, Chip, CuadroIcono, Tarjeta, TarjetaAcademia, Titulo, Vacio, clasesBoton, cx, type Tono } from "@/components/ui";
import { Ventana } from "@/components/ui/ventana";
import { PestanasPlanea } from "../pestanas-secciones";
import { BotonGuia } from "@/components/guia/boton-guia";
import { Icono, type NombreIcono } from "@/components/marca";
import { ICONOS } from "@/components/marca-datos";
import { obtenerContexto } from "@/lib/sesion";
import { tieneFuncion } from "@/lib/planes/servidor";
import { MejoraPlan } from "@/components/mejora-plan";
import { formatearCOP } from "@/lib/dinero";
import { formatearMes, hoy } from "@/lib/fechas";
import { avanceMeta, type AvanceMeta } from "@/lib/metas";
import { FormularioAporte, FormularioMeta } from "./formularios";
import { EnlacesUtiles, OfertaEnLugar } from "@/components/ofertas-app";

export const metadata = { title: "Metas de ahorro" };

const ESTADO: Record<AvanceMeta["estado"], { texto: string; tono: Tono }> = {
  cumplida: { texto: "Cumplida", tono: "ok" },
  a_tiempo: { texto: "A tiempo", tono: "ok" },
  atrasada: { texto: "Atrasada", tono: "alerta" },
  sin_plan: { texto: "Sin plan", tono: "neutro" },
};

export default function Metas() {
  return <Contenido />;
}

const mesLargo = (m: string | null) => (m ? formatearMes(m) : "sin fecha");
const veces = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

async function Contenido() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const [{ data: metas }, { data: aportes }, { data: cuentas }, conMetas] = await Promise.all([
    ctx.supabase
      .from("budgets_goals")
      .select("id, nombre, monto, ahorrado_inicial, aporte_mensual, fecha_objetivo, icono, es_emergencia")
      .eq("tipo", "meta")
      .order("es_emergencia", { ascending: false })
      .order("created_at"),
    ctx.supabase.from("transactions").select("goal_id, monto").not("goal_id", "is", null).eq("estado", "confirmado"),
    ctx.supabase.from("accounts").select("id, nombre").eq("archivada", false).neq("tipo", "tarjeta").order("created_at"),
    tieneFuncion("metas"),
  ]);
  const nueva = conMetas ? null : (
    <MejoraPlan titulo="Metas de ahorro con el plan Familia">
      Fondo de emergencia, estudio, vivienda o vacaciones: cuánto apartar cada mes y si van a tiempo.
    </MejoraPlan>
  );
  const encabezado = (
    <>
      <Titulo
        subtitulo="Para qué ahorra la casa y si van a tiempo"
        accion={
          <>
            <BotonGuia id="meta" />
            {ctx.puedeEditar && conMetas && (
              <AccionPrincipal href="/metas?nuevo=1" guia="nueva-meta">
                Nueva meta
              </AccionPrincipal>
            )}
          </>
        }
      >
        Metas de ahorro
      </Titulo>
      <PestanasPlanea activa="/metas" />
      <OfertaEnLugar lugar="metas" />
    </>
  );
  const puedeAportar = ctx.puedeEditar && !!cuentas?.length;
  const ventanas = ctx.puedeEditar && (
    <>
      {conMetas && (
        <Ventana titulo="Nueva meta de ahorro" subtitulo="Algo para lo que la casa quiere ahorrar, con fecha." guia="form-meta">
          <FormularioMeta cuentas={cuentas ?? []} hoy={fecha} />
        </Ventana>
      )}
      {puedeAportar &&
        (metas ?? []).map((m) => (
          <Ventana key={m.id} valor={`aporte-${m.id}`} titulo={`Aportar a ${m.nombre ?? "la meta"}`} subtitulo="Queda como gasto en «Ahorro e inversión»: no cuenta en el costo de vida." guia="form-aporte">
            <FormularioAporte metaId={m.id} sugerido={m.aporte_mensual ?? 0} cuentas={cuentas!} />
          </Ventana>
        ))}
    </>
  );
  const aportarEn = (id: string, clase: string) =>
    puedeAportar ? (
      <Link href={`/metas?nuevo=aporte-${id}`} scroll={false} data-guia="aportar" className={clase}>
        Aportar
      </Link>
    ) : null;
  const aportado = new Map<string, number>();
  for (const a of aportes ?? []) aportado.set(a.goal_id!, (aportado.get(a.goal_id!) ?? 0) + a.monto);
  const lista = (metas ?? []).map((m) => {
    const ahorrado = m.ahorrado_inicial + (aportado.get(m.id) ?? 0);
    const icono: NombreIcono = m.icono && m.icono in ICONOS ? (m.icono as NombreIcono) : "meta";
    return { ...m, nombre: m.nombre ?? "Meta", ahorrado, icono, ...avanceMeta({ objetivo: m.monto, ahorrado, aporteMensual: m.aporte_mensual, fechaObjetivo: m.fecha_objetivo }, fecha) };
  });
  const emergencia = lista.find((m) => m.es_emergencia);
  const otras = lista.filter((m) => m !== emergencia);
  const ahorradoTotal = lista.reduce((s, m) => s + m.ahorrado, 0);
  const sugeridos = lista.reduce((s, m) => s + (m.aporteSugerido ?? m.aporte_mensual ?? 0), 0);
  const actuales = lista.reduce((s, m) => s + (m.estado === "cumplida" ? 0 : (m.aporte_mensual ?? 0)), 0);

  if (!lista.length) {
    return (
      <>
        {encabezado}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Vacio icono="ahorro" titulo="Aún no hay metas">
            Empieza por el fondo de emergencia: tres meses del número mínimo del hogar.
          </Vacio>
          {ctx.puedeEditar && nueva}
        </div>
        {ventanas}
      </>
    );
  }

  return (
    <>
    {encabezado}
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
        {emergencia && (
          <section aria-label={emergencia.nombre} className="flex flex-col gap-4 rounded-2xl bg-monte p-4 text-arena md:p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-[#1b4a3e] text-arena">
                <Icono nombre="ahorro" tamano={24} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl leading-[26px] font-bold">{emergencia.nombre}</h2>
                <p className="text-sm text-sobre-monte">3 meses del número mínimo del hogar · meta a {mesLargo(emergencia.fecha_objetivo?.slice(0, 7) ?? null)}</p>
              </div>
              <Chip tono={ESTADO[emergencia.estado].tono}>{ESTADO[emergencia.estado].texto}</Chip>
            </div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[32px] leading-[38px] font-bold md:text-[40px] md:leading-[44px]">{formatearCOP(emergencia.ahorrado)}</span>
              <span className="text-base text-sobre-monte">de {formatearCOP(emergencia.monto)}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-[#1b4a3e]">
              <span className="block h-full rounded-full bg-teja" style={{ width: `${emergencia.porcentaje}%` }} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[13px] text-sobre-monte">Hoy cubre</p>
                <b className="text-lg">{veces.format((emergencia.ahorrado * 3) / emergencia.monto)} meses</b>
              </div>
              <div>
                <p className="text-[13px] text-sobre-monte">Aporte sugerido</p>
                <b className="text-lg">{formatearCOP(emergencia.aporteSugerido ?? 0)} / mes</b>
              </div>
              <div>
                <p className="text-[13px] text-sobre-monte">Aporte actual</p>
                <b className="text-lg">{formatearCOP(emergencia.aporte_mensual ?? 0)} / mes</b>
              </div>
            </div>
            {emergencia.estado === "atrasada" && !!emergencia.aporte_mensual && !!emergencia.aporteSugerido && (
              <p className="text-sm">
                Con {formatearCOP(emergencia.aporte_mensual)} al mes llegan en {mesLargo(emergencia.llegada)}. Suban el aporte{" "}
                {formatearCOP(emergencia.aporteSugerido - emergencia.aporte_mensual)} para llegar a tiempo.
              </p>
            )}
            {emergencia.estado !== "cumplida" && aportarEn(emergencia.id, clasesBoton("secundario", "self-start border-arena bg-arena text-monte hover:bg-arena/90"))}
          </section>
        )}

        <Tarjeta className={cx(!emergencia && "lg:col-span-3")}>
          <p className="text-sm text-cuerpo">
            Ahorrado en {lista.length} {lista.length === 1 ? "meta" : "metas"}
          </p>
          <p className="text-[32px] leading-[38px] font-bold">{formatearCOP(ahorradoTotal)}</p>
          <dl className="mt-3 space-y-2.5 text-[15px]">
            <div className="flex justify-between gap-3">
              <dt className="text-cuerpo">Aportes sugeridos del mes</dt>
              <dd className="font-bold">{formatearCOP(sugeridos)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cuerpo">Aportes actuales</dt>
              <dd className="font-bold">{formatearCOP(actuales)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-divisor pt-2.5">
              <dt className="text-cuerpo">{sugeridos > actuales ? "Faltan este mes" : "Sobran este mes"}</dt>
              <dd className={cx("font-bold", sugeridos > actuales && "text-error-tinta")}>{formatearCOP(Math.abs(sugeridos - actuales))}</dd>
            </div>
          </dl>
        </Tarjeta>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
        {otras.map((m) => (
          <section key={m.id} className="flex flex-col gap-3.5 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
            <div className="flex items-center gap-3">
              <CuadroIcono nombre={m.icono} tamano={40} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[17px] leading-[22px] font-bold">{m.nombre}</h3>
                <span className="text-[13px] text-tenue">Para {mesLargo(m.fecha_objetivo?.slice(0, 7) ?? null)}</span>
              </div>
              <Chip tono={ESTADO[m.estado].tono}>{ESTADO[m.estado].texto}</Chip>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <b className="text-2xl leading-[30px]">{formatearCOP(m.ahorrado)}</b>
              <span className="text-sm text-cuerpo">de {formatearCOP(m.monto)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex-1">
                <Barra porcentaje={m.porcentaje} tono="marca" gruesa />
              </span>
              <b className="text-sm">{m.porcentaje} %</b>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-cuerpo">Aporte sugerido</dt>
                <dd className="font-bold">{formatearCOP(m.aporteSugerido ?? 0)} / mes</dd>
              </div>
              <div>
                <dt className="text-cuerpo">Aporte actual</dt>
                <dd className="font-bold">{formatearCOP(m.aporte_mensual ?? 0)} / mes</dd>
              </div>
            </dl>
            {m.estado !== "cumplida" && aportarEn(m.id, clasesBoton("secundario", "mt-auto h-9 px-3 text-sm"))}
          </section>
        ))}
        {ctx.puedeEditar && nueva}
      </div>

      <TarjetaAcademia
        href="/academia/ahorro/cuanto-fondo"
        icono="ahorro"
        etiqueta="Academia · Ahorro y fondo de emergencia"
        titulo="¿Cuánto debe tener tu fondo de emergencia?"
      />
      <EnlacesUtiles lugar="metas" />
      {ventanas}
    </div>
    </>
  );
}
