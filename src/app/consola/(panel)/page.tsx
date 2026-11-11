import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Tarjeta, Titulo, cx } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import { describirAccion } from "@/lib/consola/auditoria";
import { formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { Barras, Embudo } from "./graficas";

export const metadata: Metadata = { title: "Panel general" };

type Metricas = {
  registrados: number;
  activos_30d: number;
  nuevos_30d: number;
  en_prueba: number;
  pagando: number;
  pagando_familia: number;
  pagando_contador: number;
  mrr: number;
  arpu: number;
  conversion_pct: number | null;
  churn_pct: number | null;
  embudo: { registrados: number; pagos_fijos: number; primer_gasto: number; pareja: number; pagan: number };
  semanas: { semana: string; n: number }[];
  meses: { mes: string; cobrado: number }[];
};
type ResumenCobros = { en_mora: number; mora_monto: number; fallidos_30d: number };

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function PanelConsola() {
  const staff = await obtenerStaff();
  const anioSiguiente = Number(hoy().slice(0, 4)) + 1;
  const [metricas, cobros, actividad, uvt, integraciones] = await Promise.all([
    staff.supabase.rpc("consola_metricas"),
    staff.supabase.rpc("consola_cobros_resumen"),
    staff.puede("auditoria") ? staff.supabase.rpc("consola_auditoria", { p_limite: 8 }) : Promise.resolve({ data: null, error: null }),
    staff.supabase.from("tax_params").select("anio").eq("pais", "CO").eq("anio", anioSiguiente).maybeSingle(),
    staff.puede("sistema") ? staff.supabase.rpc("consola_integraciones") : Promise.resolve({ data: null, error: null }),
  ]);
  const m = (metricas.data ?? {}) as Metricas;
  const r = (cobros.data ?? {}) as ResumenCobros;

  const alertas: { tono: "error" | "alerta" | "ok"; titulo: string; texto: string; href?: string }[] = [];
  if ((r.en_mora ?? 0) > 0)
    alertas.push({ tono: "error", titulo: `${r.en_mora} ${r.en_mora === 1 ? "hogar" : "hogares"} con el pago pendiente · ${formatearCOP(r.mora_monto)}`, texto: "La secuencia de recuperación está corriendo.", href: "/consola/cobros" });
  for (const i of integraciones.data ?? []) {
    if (i.verificacion && !(i.verificacion as { ok: boolean }).ok)
      alertas.push({ tono: "error", titulo: `La integración ${i.proveedor} está fallando`, texto: (i.verificacion as { detalle: string }).detalle, href: "/consola/integraciones" });
  }
  if (Number(hoy().slice(5, 7)) >= 11 && !uvt.data)
    alertas.push({ tono: "alerta", titulo: `UVT ${anioSiguiente} sin cargar`, texto: "La DIAN la publica en diciembre; los topes del año nuevo dependen de ella.", href: "/consola/parametros" });
  if ((m.en_prueba ?? 0) > 0) alertas.push({ tono: "ok", titulo: `${m.en_prueba} ${m.en_prueba === 1 ? "hogar" : "hogares"} probando Familia`, texto: "Al terminar la prueba vuelven a Gratis si no pagan." });

  return (
    <>
      <Titulo registrar={false} subtitulo={`Cómo va My House hoy, ${formatearFechaLarga(hoy())}`}>
        Panel general
      </Titulo>
      {metricas.error && <Aviso>No se pudieron cargar las métricas: {metricas.error.message}</Aviso>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-3">
        <Indicador etiqueta="MRR" valor={formatearCOP(m.mrr ?? 0)} detalle={`ingreso recurrente mensual · ARPU ${formatearCOP(m.arpu ?? 0)}`} />
        <Indicador etiqueta="Hogares activos · 30 días" valor={(m.activos_30d ?? 0).toLocaleString("es-CO")} detalle={`de ${(m.registrados ?? 0).toLocaleString("es-CO")} registrados`} />
        <Indicador
          etiqueta="Hogares pagando"
          valor={(m.pagando ?? 0).toLocaleString("es-CO")}
          detalle={`${m.pagando_familia ?? 0} Familia · ${m.pagando_contador ?? 0} Contador`}
        />
        <Indicador etiqueta="Conversión a pago" valor={m.conversion_pct == null ? "—" : `${m.conversion_pct.toLocaleString("es-CO")} %`} detalle="meta 18 %" />
        <Indicador etiqueta="Churn · 30 días" valor={m.churn_pct == null ? "—" : `${m.churn_pct.toLocaleString("es-CO")} %`} detalle="cancelaciones sobre pagando" />
        <Indicador etiqueta="Hogares nuevos · 30 días" valor={(m.nuevos_30d ?? 0).toLocaleString("es-CO")} detalle={`${m.en_prueba ?? 0} probando Familia`} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Tarjeta titulo="Cobrado por mes" subtitulo="Últimos 12 meses, en pesos" className="xl:col-span-2">
          <Barras
            alto={220}
            formato={formatearCOP}
            datos={(m.meses ?? []).map((x, i, todos) => ({
              etiqueta: MES_CORTO[Number(x.mes.slice(5, 7)) - 1],
              valor: x.cobrado,
              detalle: x.mes,
              destacar: i === todos.length - 1,
            }))}
          />
        </Tarjeta>
        <Tarjeta titulo="Requiere atención" subtitulo={alertas.length ? `${alertas.length} ${alertas.length === 1 ? "aviso" : "avisos"}` : "Todo en orden"}>
          {alertas.length === 0 ? (
            <p className="text-sm text-tenue">Sin pagos en mora ni integraciones fallando.</p>
          ) : (
            <ul className="flex flex-col">
              {alertas.map((a) => (
                <li key={a.titulo} className="flex items-start gap-3 border-b border-divisor py-3 text-sm last:border-0">
                  <span aria-hidden className={cx("mt-[5px] size-2.5 shrink-0 rounded-full", a.tono === "error" ? "bg-error" : a.tono === "alerta" ? "bg-alerta" : "bg-ok")} />
                  <span>
                    <b>{a.titulo}</b>
                    <br />
                    <span className="text-cuerpo">{a.texto}</span>
                    {a.href && (
                      <>
                        {" "}
                        <Link href={a.href} className="font-semibold underline-offset-4 hover:underline">
                          Ver
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-3">
        <Tarjeta titulo="Activación de hogares" subtitulo="Del registro al pago, todos los tiempos" className="xl:col-span-2">
          <Embudo
            pasos={[
              { texto: "Se registraron", valor: m.embudo?.registrados ?? 0 },
              { texto: "Cargaron pagos fijos", valor: m.embudo?.pagos_fijos ?? 0 },
              { texto: "Registraron un gasto", valor: m.embudo?.primer_gasto ?? 0 },
              { texto: "Invitaron a la pareja", valor: m.embudo?.pareja ?? 0 },
              { texto: "Pagan un plan", valor: m.embudo?.pagan ?? 0 },
            ]}
          />
        </Tarjeta>
        <Tarjeta titulo="Nuevos hogares por semana" subtitulo="Últimas 6 semanas">
          <Barras alto={170} datos={(m.semanas ?? []).map((s) => ({ etiqueta: s.semana.slice(5), valor: s.n, detalle: `Semana del ${s.semana}` }))} />
        </Tarjeta>
      </div>

      {staff.puede("auditoria") && (
        <div className="mt-5">
          <Tarjeta
            titulo="Actividad reciente"
            subtitulo="Acciones del equipo"
            accion={
              <Link href="/consola/privacidad" className="text-sm font-semibold">
                Ver todo
              </Link>
            }
          >
            {(actividad.data ?? []).length === 0 ? (
              <p className="text-sm text-tenue">Aún no hay actividad.</p>
            ) : (
              <ul className="flex flex-col">
                {actividad.data!.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 border-b border-divisor py-3 text-sm last:border-0">
                    <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-full bg-ok" />
                    <span>
                      <b>{a.quien_nombre}</b> · {describirAccion(a)}
                    </span>
                    <span className="ml-auto pl-3 text-xs whitespace-nowrap text-tenue">{formatearMomento(a.creada)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      )}
      <p className="mt-5 text-[13px] text-tenue">
        Cobrado por mes = pagos recibidos ese mes (no el MRR histórico). Activos = hogares que registraron movimientos en los últimos 30 días.
      </p>
    </>
  );
}
