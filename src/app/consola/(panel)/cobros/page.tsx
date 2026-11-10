import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Barra, Chip, EnlaceBoton, Tarjeta, Titulo, cx, type Tono } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { esPruebas } from "@/lib/pagos/wompi";
import { obtenerWompi } from "@/lib/pagos/servidor";
import { TarjetaTabla } from "../tarjeta-tabla";
import { etiquetaPlan } from "../hogares/comun";

export const metadata: Metadata = { title: "Suscripciones y cobros" };

const ESTADOS = [
  { valor: "", texto: "Todos" },
  { valor: "pagado", texto: "Pagados" },
  { valor: "pendiente", texto: "Pendientes" },
  { valor: "fallido", texto: "Fallidos" },
  { valor: "reembolsado", texto: "Reembolsados" },
] as const;
const TONO: Record<string, Tono> = { pagado: "ok", pendiente: "alerta", fallido: "error", anulado: "neutro", reembolsado: "info" };
const TEXTO: Record<string, string> = { pagado: "Pagado", pendiente: "Pendiente", fallido: "Fallido", anulado: "Anulado", reembolsado: "Reembolsado" };

type Resumen = {
  cobrado_mes: number;
  cobros_mes: number;
  fallidos_30d: number;
  mora_monto: number;
  en_mora: number;
  recuperados_pct: number | null;
  proximos_7d: number;
  proximos_7d_n: number;
  mrr: number;
  activas: number;
  metodos: Record<string, number>;
};
type Cobro = {
  id: string;
  creado: string;
  household_id: string;
  hogar: string;
  plan: string;
  periodo: string;
  motivo: string;
  monto: number;
  cupon: string | null;
  estado: string;
  metodo: string | null;
  metodo_detalle: string | null;
  error: string | null;
  factura_estado: string;
};

const SECUENCIA = [
  { t: "Día −3", b: "Cobro de renovación y correo", d: "Con el valor y el botón para pagar con Wompi." },
  { t: "Día 1", b: "Correo de pago pendiente", d: "El plan sigue activo; en Configuración → Plan aparece el pago." },
  { t: "Día 3", b: "Segundo aviso por correo", d: "WhatsApp cuando se conecte (plantilla pago_fallido)." },
  { t: "Día 7", b: "Último aviso", d: "Avisa la fecha en que pasa a Gratis." },
  { t: "Día 14", b: "Pasa a Gratis", d: "Conserva sus datos; pierde comprobantes ilimitados, metas y renta." },
];

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function CobrosConsola({ searchParams }: PageProps<"/consola/cobros">) {
  const staff = await obtenerStaff();
  const sp = await searchParams;
  const estado = ESTADOS.find((e) => e.valor === sp.estado)?.valor ?? "";
  const antes = typeof sp.antes === "string" && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : undefined;
  const [resumen, lista] = await Promise.all([
    staff.supabase.rpc("consola_cobros_resumen"),
    staff.supabase.rpc("consola_cobros", { p_estado: estado || undefined, p_antes: antes, p_limite: 30 }),
  ]);
  const r = (resumen.data ?? {}) as Resumen;
  const filas = (lista.data ?? []) as Cobro[];
  const metodos = Object.entries(r.metodos ?? {}).sort((a, b) => b[1] - a[1]);
  const totalMetodos = metodos.reduce((s, [, n]) => s + n, 0);
  const wompi = await obtenerWompi();
  const url = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ estado: estado || undefined, ...cambios })) if (v) p.set(k, v);
    return `/consola/cobros${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <Titulo registrar={false} subtitulo="Wompi y factura electrónica">
        Suscripciones y cobros
      </Titulo>
      {(resumen.error || lista.error) && <Aviso>{mensajeError(resumen.error ?? lista.error)}</Aviso>}
      {!wompi ? (
        <div className="mb-4">
          <Aviso tipo="info">Wompi no está conectado: los hogares aún no pueden pagar. Conéctalo en Integraciones.</Aviso>
        </div>
      ) : (
        esPruebas(wompi.publica) && (
          <div className="mb-4">
            <Aviso tipo="info">Wompi en modo pruebas (sandbox): ningún cobro es real.</Aviso>
          </div>
        )
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Indicador etiqueta="MRR" valor={formatearCOP(r.mrr ?? 0)} detalle={`${r.activas ?? 0} suscripciones activas`} />
        <Indicador etiqueta="Cobrado este mes" valor={formatearCOP(r.cobrado_mes ?? 0)} detalle={`${r.cobros_mes ?? 0} cobros exitosos`} />
        <Indicador etiqueta="En mora" valor={String(r.en_mora ?? 0)} detalle={`${formatearCOP(r.mora_monto ?? 0)} por recuperar · ${r.fallidos_30d ?? 0} fallidos en 30 d`} />
        <Indicador etiqueta="Próximos 7 días" valor={formatearCOP(r.proximos_7d ?? 0)} detalle={`${r.proximos_7d_n ?? 0} renovaciones · recuperación ${r.recuperados_pct == null ? "—" : `${r.recuperados_pct} %`}`} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <TarjetaTabla
          titulo="Cobros recientes"
          subtitulo="Wompi para Colombia: tarjeta, PSE, Nequi, Daviplata y Bancolombia"
          accion={
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <Link
                  key={e.valor}
                  href={url({ estado: e.valor || undefined, antes: undefined })}
                  className={cx("inline-flex h-8 items-center rounded-full border px-3 text-sm", estado === e.valor ? "border-monte bg-monte text-arena" : "border-control bg-elevada")}
                >
                  {e.texto}
                </Link>
              ))}
            </div>
          }
          pie={
            (antes || filas.length === 30) && (
              <div className="flex justify-between">
                {antes ? (
                  <EnlaceBoton href={url({ antes: undefined })} variante="secundario" className="h-9 text-sm">
                    Más recientes
                  </EnlaceBoton>
                ) : (
                  <span />
                )}
                {filas.length === 30 && (
                  <EnlaceBoton href={url({ antes: filas[filas.length - 1].creado })} variante="secundario" className="h-9 text-sm">
                    Más antiguos
                  </EnlaceBoton>
                )}
              </div>
            )
          }
        >
          {filas.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">No hay cobros con ese filtro.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Fecha</th>
                  <th>Hogar</th>
                  <th>Plan</th>
                  <th className="der">Monto</th>
                  <th>Estado</th>
                  <th className="pr-4! md:pr-6!">Factura DIAN</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id}>
                    <td className="pl-4! text-cuerpo md:pl-6!">{formatearMomento(c.creado)}</td>
                    <td>
                      <span className="flex flex-col leading-[18px]">
                        <Link href={`/consola/hogares/${c.household_id}`} className="font-bold underline-offset-4 hover:underline">
                          {c.hogar}
                        </Link>
                        <small className="text-xs text-tenue">{[c.metodo, c.metodo_detalle].filter(Boolean).join(" ") || (c.motivo === "renovacion" ? "Renovación" : "Alta")}</small>
                      </span>
                    </td>
                    <td>
                      <Chip plano>
                        {etiquetaPlan(c.plan)} {c.periodo}
                      </Chip>
                    </td>
                    <td className="der font-bold">{formatearCOP(c.monto)}</td>
                    <td>
                      <Chip tono={TONO[c.estado]}>{c.estado === "fallido" && c.error ? `Fallido · ${c.error.toLowerCase()}` : TEXTO[c.estado] ?? c.estado}</Chip>
                    </td>
                    <td className="pr-4! md:pr-6!">
                      {c.estado !== "pagado" ? (
                        <Chip plano>No aplica</Chip>
                      ) : c.factura_estado === "emitida" ? (
                        <Chip tono="ok">Emitida</Chip>
                      ) : c.factura_estado === "no_aplica" ? (
                        <Chip plano>No aplica</Chip>
                      ) : (
                        <Chip tono="alerta">Pendiente</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta titulo="Recuperación de pagos" subtitulo="Secuencia automática (cron diario)">
            <ol className="flex flex-col">
              {SECUENCIA.map((s) => (
                <li key={s.t} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-divisor py-3 text-sm last:border-0">
                  <span className="font-semibold text-tenue">{s.t}</span>
                  <span>
                    <b>{s.b}</b>
                    <br />
                    <span className="text-cuerpo">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Tarjeta>
          <Tarjeta titulo="Medios de pago" subtitulo="Cobros de los últimos 30 días">
            {totalMetodos === 0 ? (
              <p className="text-sm text-tenue">Aún no hay cobros pagados.</p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {metodos.map(([m, n]) => {
                  const pct = Math.round((n / totalMetodos) * 100);
                  return (
                    <div key={m}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="text-cuerpo">{m}</span>
                        <b>{pct} %</b>
                      </div>
                      <Barra porcentaje={pct} tono="marca" gruesa />
                    </div>
                  );
                })}
              </div>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
