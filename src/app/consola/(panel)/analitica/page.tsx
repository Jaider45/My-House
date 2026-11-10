import type { Metadata } from "next";
import { Aviso, Titulo } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { TarjetaTabla } from "../tarjeta-tabla";

export const metadata: Metadata = { title: "Analítica" };

type Analitica = {
  cohortes: { mes: string; hogares: number; ret: (number | null)[] }[];
  canales: { canal: string; hogares: number; pagando: number }[];
  mov_semana_mediana: number;
  pareja_pct: number | null;
};

const MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CANALES: Record<string, string> = { directo: "Orgánico y directo", contador: "Contadores aliados", "meta-ads": "Meta Ads" };

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function AnaliticaConsola() {
  const staff = await obtenerStaff();
  const { data, error } = await staff.supabase.rpc("consola_analitica");
  const a = (data ?? { cohortes: [], canales: [], mov_semana_mediana: 0, pareja_pct: null }) as unknown as Analitica;
  const conM3 = a.cohortes.map((c) => c.ret[3]).filter((x): x is number => x != null);
  const retencion3m = conM3.length ? Math.round(conM3.reduce((s, x) => s + x, 0) / conM3.length) : null;

  return (
    <>
      <Titulo registrar={false} subtitulo="Retención, activación y adquisición">
        Analítica
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Indicador etiqueta="Retención a 3 meses" valor={retencion3m == null ? "—" : `${retencion3m} %`} detalle="meta 60 % · promedio de cohortes" />
        <Indicador etiqueta="Movimientos por hogar · semana" valor={String(a.mov_semana_mediana ?? 0)} detalle="mediana de hogares activos" />
        <Indicador etiqueta="Hogares con pareja activa" valor={a.pareja_pct == null ? "—" : `${a.pareja_pct} %`} detalle="dos o más personas con acceso" />
        <Indicador etiqueta="Cohortes" valor={String(a.cohortes.length)} detalle="últimos 6 meses" />
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
                  <th className="der pr-4! md:pr-6!">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {a.canales.map((c) => (
                  <tr key={c.canal}>
                    <td className="pl-4! font-bold md:pl-6!">{CANALES[c.canal] ?? c.canal}</td>
                    <td className="der">{c.hogares.toLocaleString("es-CO")}</td>
                    <td className="der">{c.pagando.toLocaleString("es-CO")}</td>
                    <td className="der pr-4! md:pr-6!">{c.hogares ? `${((100 * c.pagando) / c.hogares).toFixed(1).replace(".", ",")} %` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>
        <p className="text-[13px] text-tenue">El CAC por canal llega cuando se cargue la inversión mensual de pauta (pendiente del roadmap).</p>
      </div>
    </>
  );
}
