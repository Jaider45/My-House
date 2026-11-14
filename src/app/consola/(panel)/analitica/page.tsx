import type { Metadata } from "next";
import { Aviso, Titulo } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import Link from "next/link";
import { cx, Tarjeta } from "@/components/ui";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { formatearCOP } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { TarjetaTabla } from "../tarjeta-tabla";
import { guardarInversion } from "./acciones";

export const metadata: Metadata = { title: "Analítica" };

type Analitica = {
  cohortes: { mes: string; hogares: number; ret: (number | null)[] }[];
  canales: { canal: string; hogares: number; pagando: number }[];
  mov_semana_mediana: number;
  pareja_pct: number | null;
};

const MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CANALES: Record<string, string> = { directo: "Orgánico y directo", contador: "Contadores aliados", "meta-ads": "Meta Ads" };
const PERIODOS = [
  [7, "7 días"],
  [30, "30 días"],
  [365, "12 meses"],
] as const;
/** Cómo registran: el origen de cada movimiento (los del cron de pagos fijos no cuentan). */
const ORIGENES: [string, string, string][] = [
  ["whatsapp", "WhatsApp", "bg-monte"],
  ["ocr", "Foto o PDF en la app", "bg-teja"],
  ["manual", "Escrito a mano", "bg-ok"],
  ["importacion", "Extracto importado", "bg-alerta"],
  ["banco", "Conexión bancaria", "bg-cuerpo"],
];
type Periodo = { dias: number; registro_ms_mediana: number | null; registros_medidos: number; origenes: Record<string, number>; activos: number; inversion: { mes: string; canal: string; monto: number }[]; cac: Record<string, number | null> };

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function AnaliticaConsola({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const staff = await obtenerStaff();
  const pedido = Number((await searchParams).periodo);
  const dias = PERIODOS.find(([d]) => d === pedido)?.[0] ?? 30;
  const [{ data, error }, { data: datosPeriodo }] = await Promise.all([staff.supabase.rpc("consola_analitica"), staff.supabase.rpc("consola_analitica_periodo", { p_dias: dias })]);
  const p = (datosPeriodo ?? { origenes: {}, inversion: [], cac: {} }) as Periodo;
  const totalOrigen = Object.values(p.origenes ?? {}).reduce((s, n) => s + n, 0);
  const segundos = p.registro_ms_mediana == null ? null : Math.round(p.registro_ms_mediana / 100) / 10;
  const a = (data ?? { cohortes: [], canales: [], mov_semana_mediana: 0, pareja_pct: null }) as unknown as Analitica;
  const conM3 = a.cohortes.map((c) => c.ret[3]).filter((x): x is number => x != null);
  const retencion3m = conM3.length ? Math.round(conM3.reduce((s, x) => s + x, 0) / conM3.length) : null;

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Retención, activación y adquisición"
        accion={
          <nav aria-label="Periodo" className="flex gap-1 rounded-xl border border-borde bg-elevada p-1">
            {PERIODOS.map(([d, t]) => (
              <Link
                key={d}
                href={d === 30 ? "/consola/analitica" : `/consola/analitica?periodo=${d}`}
                aria-current={d === dias ? "page" : undefined}
                className={cx("inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold", d === dias ? "bg-monte text-arena" : "text-cuerpo hover:bg-mosaico")}
              >
                {t}
              </Link>
            ))}
          </nav>
        }
      >
        Analítica
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Indicador etiqueta="Retención a 3 meses" valor={retencion3m == null ? "—" : `${retencion3m} %`} detalle="meta 60 % · promedio de cohortes" />
        <Indicador etiqueta="Movimientos por hogar · semana" valor={String(a.mov_semana_mediana ?? 0)} detalle="mediana de hogares activos" />
        <Indicador etiqueta="Hogares con pareja activa" valor={a.pareja_pct == null ? "—" : `${a.pareja_pct} %`} detalle="dos o más personas con acceso" />
        <Indicador
          etiqueta="Tiempo medio de registro"
          valor={segundos == null ? "—" : `${segundos.toLocaleString("es-CO")} s`}
          detalle={`meta: menos de 10 s · ${p.registros_medidos ?? 0} registros medidos`}
        />
      </section>

      <div className="flex flex-col gap-5">
        <TarjetaTabla titulo="Retención por cohorte" subtitulo="Porcentaje de hogares que siguen registrando movimientos cada mes">
          {a.cohortes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay cohortes con datos.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Cohorte</th>
                  <th className="der">Hogares</th>
                  {[0, 1, 2, 3, 4, 5].map((k) => (
                    <th key={k} className="text-center!">
                      Mes {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.cohortes.map((c) => (
                  <tr key={c.mes}>
                    <td className="pl-4! font-bold md:pl-6!">{MES_LARGO[Number(c.mes.slice(5, 7)) - 1]}</td>
                    <td className="der">{c.hogares.toLocaleString("es-CO")}</td>
                    {c.ret.map((pct, k) => (
                      <td key={k} className="p-0!">
                        {pct == null ? (
                          <span className="block px-3 py-2.5 text-center" />
                        ) : (
                          <span
                            className="block px-3 py-2.5 text-center font-semibold tabular-nums"
                            style={{ background: `rgba(20,61,51,${0.15 + 0.77 * (pct / 100)})`, color: "#faf5ee" }}
                          >
                            {pct} %
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <TarjetaTabla titulo="Adquisición por canal" subtitulo="De dónde llegan los hogares (utm_source o enlace de referido) · todos los tiempos">
          {a.canales.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay hogares.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Canal</th>
                  <th className="der">Hogares</th>
                  <th className="der">Pagando</th>
                  <th className="der">Conversión</th>
                  <th className="der pr-4! md:pr-6!">CAC · 90 d</th>
                </tr>
              </thead>
              <tbody>
                {a.canales.map((c) => (
                  <tr key={c.canal}>
                    <td className="pl-4! font-bold md:pl-6!">{CANALES[c.canal] ?? c.canal}</td>
                    <td className="der">{c.hogares.toLocaleString("es-CO")}</td>
                    <td className="der">{c.pagando.toLocaleString("es-CO")}</td>
                    <td className="der">{c.hogares ? `${((100 * c.pagando) / c.hogares).toFixed(1).replace(".", ",")} %` : "—"}</td>
                    <td className="der pr-4! md:pr-6!">{p.cac?.[c.canal] != null ? formatearCOP(p.cac[c.canal]!) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Tarjeta titulo="Cómo registran" subtitulo={`Movimientos de los últimos ${PERIODOS.find(([d]) => d === dias)![1]} · ${totalOrigen.toLocaleString("es-CO")} en total`}>
            <div className="flex flex-col gap-3.5">
              {ORIGENES.filter(([k]) => (p.origenes?.[k] ?? 0) > 0 || k !== "banco").map(([k, t, color]) => {
                const v = totalOrigen ? Math.round((100 * (p.origenes?.[k] ?? 0)) / totalOrigen) : 0;
                return (
                  <div key={k}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-cuerpo">{t}</span>
                      <b>{v} %</b>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-mosaico">
                      <span className={cx("block h-full rounded-full", color)} style={{ width: `${v}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Tarjeta>
          <Tarjeta titulo="Inversión por canal" subtitulo="Lo invertido cada mes en pauta o comisiones: con esto se calcula el CAC (inversión de 90 días ÷ hogares que empezaron a pagar)">
            {staff.puede("cobros") && (
              <FormularioEstado accion={guardarInversion} className="mb-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-cuerpo">
                  Mes
                  <input type="month" name="mes" defaultValue={hoy().slice(0, 7)} required className="h-10 rounded-lg border border-control bg-elevada px-2 text-sm font-normal" />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-cuerpo">
                  Canal (utm_source)
                  <input name="canal" list="canales-conocidos" required placeholder="meta-ads" className="h-10 w-[160px] rounded-lg border border-control bg-elevada px-2 text-sm font-normal" />
                </label>
                <datalist id="canales-conocidos">
                  {a.canales.map((c) => (
                    <option key={c.canal} value={c.canal} />
                  ))}
                </datalist>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-cuerpo">
                  Monto (0 = borrar)
                  <input name="monto" inputMode="numeric" required placeholder="1.200.000" className="h-10 w-[140px] rounded-lg border border-control bg-elevada px-2 text-right text-sm font-normal" />
                </label>
                <BotonEnviar variante="secundario" className="h-10 text-sm" pendiente="…">
                  Guardar
                </BotonEnviar>
              </FormularioEstado>
            )}
            {(p.inversion ?? []).length === 0 ? (
              <p className="text-sm text-tenue">Aún no hay inversión cargada.</p>
            ) : (
              <ul className="flex flex-col text-sm">
                {p.inversion.map((i) => (
                  <li key={`${i.mes}-${i.canal}`} className="flex min-h-9 items-center justify-between gap-3 border-b border-divisor last:border-0">
                    <span className="text-cuerpo">
                      {i.mes} · {CANALES[i.canal] ?? i.canal}
                    </span>
                    <b>{formatearCOP(i.monto)}</b>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
