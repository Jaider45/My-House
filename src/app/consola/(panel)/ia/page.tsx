import type { Metadata } from "next";
import Link from "next/link";
import { AreaTexto, Aviso, Campo, Chip, Tarjeta, Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { preciosATexto, type Precios } from "@/lib/consola/precios-ia";
import { CONFIANZA_MINIMA } from "@/lib/comprobantes";
import { TarjetaTabla } from "../tarjeta-tabla";
import { FormularioConsola } from "../formulario";
import { Barras } from "../graficas";
import { guardarConfigIa } from "./acciones";

export const metadata: Metadata = { title: "IA y automatizaciones" };

type Datos = {
  config: { ia_umbral?: number; ia_tope_usd_mes?: number | null; ia_precios?: Precios };
  mes: { lecturas: number; comprobantes: number; extractos: number; costo_usd: number; sin_precio: number; ms_promedio: number; hogares: number };
  modelos: { modelo: string; lecturas: number; costo_usd: number }[];
  precision: { registrados: number; acertados: number };
  meses: { mes: string; lecturas: number; costo_usd: number }[];
};

const usd = (n: number) => `US$ ${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function IaConsola() {
  const staff = await obtenerStaff();
  const { data, error } = await staff.supabase.rpc("consola_ia");
  const d = (data ?? null) as unknown as Datos | null;
  const puede = staff.puede("parametros");
  const umbral = d?.config.ia_umbral ?? CONFIANZA_MINIMA;
  const tope = d?.config.ia_tope_usd_mes ?? null;
  const precision = d && d.precision.registrados ? Math.round((100 * d.precision.acertados) / d.precision.registrados) : null;
  const usoTope = d && tope ? Math.min(100, Math.round((100 * d.mes.costo_usd) / tope)) : null;

  return (
    <>
      <Titulo registrar={false} subtitulo="Lecturas de comprobantes y extractos: costo, precisión y las reglas con que decide">
        IA y automatizaciones
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}
      {d && (
        <>
          <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
            <Indicador etiqueta="Lecturas del mes" valor={d.mes.lecturas.toLocaleString("es-CO")} detalle={`${d.mes.comprobantes} comprobantes · ${d.mes.extractos} extractos · ${d.mes.hogares} hogares`} />
            <Indicador
              etiqueta="Costo del mes"
              valor={usd(Number(d.mes.costo_usd))}
              detalle={tope ? `${usoTope} % del tope de ${usd(tope)}` : d.mes.sin_precio ? `${d.mes.sin_precio} lecturas sin precio cargado` : "Sin tope de gasto"}
            />
            <Indicador etiqueta="Precisión de categoría" valor={precision === null ? "—" : `${precision} %`} detalle={`Comprobantes registrados sin que nadie cambiara la categoría (${d.precision.registrados})`} />
            <Indicador etiqueta="Tiempo de lectura" valor={d.mes.ms_promedio ? `${(d.mes.ms_promedio / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} s` : "—"} detalle="Promedio por lectura" />
          </section>
          {usoTope !== null && usoTope >= 100 && (
            <div className="mb-5">
              <Aviso>Se alcanzó el tope de gasto del mes: las lecturas con IA están en pausa hasta el mes siguiente o hasta que subas el tope.</Aviso>
            </div>
          )}
        </>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {d && (
            <Tarjeta titulo="Lecturas por mes" subtitulo="Últimos 6 meses">
              <Barras alto={170} datos={d.meses.map((m) => ({ etiqueta: m.mes.slice(2), valor: m.lecturas, detalle: `${m.mes}: ${usd(Number(m.costo_usd))}` }))} />
            </Tarjeta>
          )}
          {d && (
            <TarjetaTabla titulo="Por modelo" subtitulo="Este mes">
              {d.modelos.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-tenue md:px-6">Sin lecturas con modelo registrado este mes.</p>
              ) : (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="pl-4! md:pl-6!">Modelo</th>
                      <th className="der">Lecturas</th>
                      <th className="der pr-4! md:pr-6!">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.modelos.map((m) => (
                      <tr key={m.modelo}>
                        <td className="pl-4! font-mono text-[13px] md:pl-6!">{m.modelo}</td>
                        <td className="der">{m.lecturas}</td>
                        <td className="der pr-4! md:pr-6!">{usd(Number(m.costo_usd))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TarjetaTabla>
          )}
          <Tarjeta titulo="WhatsApp Business y flujos" subtitulo="Registro por WhatsApp y plantillas aprobadas por Meta: es su propia fase">
            <p className="flex flex-wrap items-center gap-2 text-sm text-cuerpo">
              <Chip plano>No conectado</Chip>
              La conexión con Meta se configura en{" "}
              <Link href="/consola/integraciones" className="font-semibold text-tinta underline">
                Integraciones
              </Link>
              ; el registro de movimientos por WhatsApp llega después.
            </p>
          </Tarjeta>
        </div>

        <Tarjeta titulo="Configuración" subtitulo="Rige en todos los hogares desde la siguiente lectura">
          <FormularioConsola accion={guardarConfigIa} className="flex flex-col gap-3">
            <Campo
              etiqueta="Umbral de confianza (50–100)"
              name="umbral"
              type="number"
              min={50}
              max={100}
              defaultValue={umbral}
              disabled={!puede}
              ayuda="Por debajo de este número la app pregunta antes de registrar. Más alto = más preguntas y menos errores."
            />
            <Campo
              etiqueta="Tope de gasto del mes (US$)"
              name="tope"
              inputMode="decimal"
              defaultValue={tope ?? ""}
              placeholder="Sin tope"
              disabled={!puede}
              ayuda="Al llegar, las lecturas se pausan para todos hasta el mes siguiente."
            />
            <AreaTexto
              etiqueta="Precio por modelo (US$ por millón de tokens: entrada, salida)"
              name="precios"
              rows={4}
              defaultValue={preciosATexto(d?.config.ia_precios ?? {})}
              placeholder={"claude-opus: 5, 25\ngpt-6.1: 2, 8"}
              disabled={!puede}
              spellCheck={false}
            />
            <p className="-mt-1 text-[13px] text-tenue">Toma los precios vigentes de la página de cada proveedor. El nombre es un prefijo: «claude-opus» vale para todas sus versiones.</p>
            {puede && (
              <BotonEnviar pendiente="Guardando…" className="self-start">
                Guardar
              </BotonEnviar>
            )}
          </FormularioConsola>
        </Tarjeta>
      </div>
    </>
  );
}
