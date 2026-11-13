import Link from "next/link";
import { AccionPrincipal, IconoMas, Barra, Chip, CuadroIcono, Tarjeta, TarjetaAcademia, Titulo, Vacio, clasesBoton, type Tono } from "@/components/ui";
import { Ventana } from "@/components/ui/ventana";
import { PestanasPagos } from "../pestanas-secciones";
import { Icono, type NombreIcono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, formatearMes, hoy, mesDe, sumarMeses } from "@/lib/fechas";
import { avanceDeuda } from "@/lib/deudas";
import { FormularioAbono, FormularioDeuda } from "./formularios";
import { BotonGuia } from "@/components/guia/boton-guia";

export const metadata = { title: "Deudas" };

export default function Deudas() {
  return <Contenido />;
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

async function Contenido() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const mes = mesDe(fecha);
  const [{ data: deudas }, { data: movs }, { data: cuentas }] = await Promise.all([
    ctx.supabase.from("debts").select("id, nombre, detalle, monto, pagado_inicial, cuota, cuotas_total, dia_pago, fecha_limite").eq("archivada", false).order("created_at"),
    ctx.supabase.from("transactions").select("debt_id, monto, estado, fecha").not("debt_id", "is", null),
    ctx.supabase.from("accounts").select("id, nombre").eq("archivada", false).neq("tipo", "tarjeta").order("created_at"),
  ]);

  const filas = (deudas ?? []).map((d) => {
    const suyos = (movs ?? []).filter((m) => m.debt_id === d.id);
    const abonos = suyos.filter((m) => m.estado === "confirmado").reduce((s, m) => s + m.monto, 0);
    const vencida = suyos.find((m) => m.estado === "programado" && m.fecha < fecha);
    const delMes = suyos.filter((m) => m.fecha.startsWith(mes)).reduce((s, m) => s + m.monto, 0);
    const a = avanceDeuda({ ...d, abonos });
    const estado: { texto: string; tono: Tono } = a.pendiente === 0 ? { texto: "Pagada", tono: "ok" } : vencida ? { texto: "Cuota vencida", tono: "error" } : { texto: "Al día", tono: "ok" };
    const icono: NombreIcono = /tarjeta|visa|master/i.test(d.nombre) ? "cuentas" : /famil|mam|pap/i.test(`${d.nombre} ${d.detalle}`) ? "familia" : "deducciones";
    return { ...d, ...a, vencida, delMes, estado, icono };
  });

  const total = filas.reduce((t, f) => ({ monto: t.monto + f.monto, pagado: t.pagado + f.pagado, pendiente: t.pendiente + f.pendiente, delMes: t.delMes + f.delMes }), {
    monto: 0,
    pagado: 0,
    pendiente: 0,
    delMes: 0,
  });
  const pctTotal = total.monto ? Math.floor((total.pagado * 100) / total.monto) : 0;
  const mesesFin = Math.max(0, ...filas.map((f) => f.mesesRestantes ?? 0));
  const libre = mayuscula(formatearMes(sumarMeses(mes, mesesFin)).replace(" de ", " "));
  const vencida = filas.find((f) => f.vencida && f.cuota);
  const conAbono = ctx.puedeEditar && !!cuentas?.length;

  return (
    <>
      <Titulo
        subtitulo="Cuánto deben, cuánto llevan pagado y cuándo terminan"
        accion={
          <>
            <BotonGuia id="deuda" />
            {ctx.puedeEditar && (
              <AccionPrincipal href="/deudas?nuevo=1" guia="nueva-deuda">
                Nueva deuda
              </AccionPrincipal>
            )}
          </>
        }
      >
        Deudas del hogar
      </Titulo>
      <PestanasPagos activa="/deudas" />
    <div className="space-y-4 md:space-y-5">
      {filas.length === 0 ? (
        <Vacio icono="deducciones" titulo="Sin deudas registradas">
          Agrega los créditos, compras a cuotas y préstamos del hogar para ver cuándo terminan.
        </Vacio>
      ) : (
        <>
          <Tarjeta>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="col-span-2 lg:col-span-1">
                <p className="text-sm text-cuerpo">Saldo pendiente total</p>
                <p className="text-[32px] leading-[38px] font-bold">{formatearCOP(total.pendiente)}</p>
              </div>
              <div>
                <p className="text-sm text-cuerpo">Pagado</p>
                <p className="text-[22px] leading-[30px] font-bold">{formatearCOP(total.pagado)}</p>
                <p className="text-[13px] text-cuerpo">de {formatearCOP(total.monto)}</p>
              </div>
              <div>
                <p className="text-sm text-cuerpo">Cuotas de este mes</p>
                <p className="text-[22px] leading-[30px] font-bold">{formatearCOP(total.delMes)}</p>
              </div>
              <div>
                <p className="text-sm text-cuerpo">Sin deudas con cuota</p>
                <p className="text-[22px] leading-[30px] font-bold">{mesesFin ? libre : "Ya"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex-1">
                <Barra porcentaje={pctTotal} tono="marca" gruesa />
              </span>
              <b>{pctTotal} %</b>
            </div>
          </Tarjeta>

          <div className="relative hidden overflow-x-auto rounded-2xl border border-borde bg-elevada md:block">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Deuda</th>
                  <th className="der hidden 2xl:table-cell">Saldo acordado</th>
                  <th className="der">Pagado</th>
                  <th className="der">Saldo pendiente</th>
                  <th className="der">Cuota</th>
                  <th className="hidden xl:table-cell">Fecha límite</th>
                  <th className="min-w-[170px]">Progreso</th>
                  <th>Estado</th>
                  {conAbono && <th className="w-px"><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((d) => (
                  <tr key={d.id}>
                    <td className="h-[60px]">
                      <span className="inline-flex items-center gap-2.5">
                        <CuadroIcono nombre={d.icono} />
                        <span className="flex flex-col">
                          <b>{d.nombre}</b>
                          <span className="text-[13px] text-tenue">{d.detalle}</span>
                        </span>
                      </span>
                    </td>
                    <td className="der hidden text-cuerpo 2xl:table-cell">{formatearCOP(d.monto)}</td>
                    <td className="der">{formatearCOP(d.pagado)}</td>
                    <td className="der font-bold">{formatearCOP(d.pendiente)}</td>
                    <td className="der">{d.cuota ? formatearCOP(d.cuota) : "Abonos libres"}</td>
                    <td className="hidden text-cuerpo xl:table-cell">{d.fecha_limite ? formatearFecha(d.fecha_limite) : "—"}</td>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="flex-1">
                          <Barra porcentaje={d.porcentaje} tono="marca" />
                        </span>
                        <span className="w-10 text-right text-[13px] text-cuerpo">{d.porcentaje} %</span>
                      </span>
                      <span className="text-[13px] text-tenue">{d.cuotasPagadas != null ? `${d.cuotasPagadas} de ${d.cuotas_total ?? "?"} cuotas` : "Abonos libres"}</span>
                    </td>
                    <td>
                      <Chip tono={d.estado.tono}>{d.estado.texto}</Chip>
                    </td>
                    {conAbono && (
                      <td className="!pl-0">
                        {d.pendiente > 0 && (
                          <Link
                            href={`/deudas?nuevo=abono-${d.id}`}
                            scroll={false}
                            data-guia="abonar"
                            title={`Registrar abono a ${d.nombre}`}
                            aria-label={`Registrar abono a ${d.nombre}`}
                            className={clasesBoton("secundario", "!size-9 !px-0")}
                          >
                            <IconoMas tamano={18} />
                          </Link>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-mosaico font-bold [&>td]:border-t [&>td]:border-borde">
                  <td>
                    Total · {filas.length} {filas.length === 1 ? "deuda" : "deudas"}
                  </td>
                  <td className="der hidden 2xl:table-cell">{formatearCOP(total.monto)}</td>
                  <td className="der">{formatearCOP(total.pagado)}</td>
                  <td className="der">{formatearCOP(total.pendiente)}</td>
                  <td className="der">{formatearCOP(total.delMes)}</td>
                  <td className="hidden xl:table-cell" />
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className="flex-1">
                        <Barra porcentaje={pctTotal} tono="marca" />
                      </span>
                      <span className="w-10 text-right text-[13px] text-cuerpo">{pctTotal} %</span>
                    </span>
                  </td>
                  <td />
                  {conAbono && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {filas.map((d) => (
              <section key={d.id} className="flex flex-col gap-3 rounded-2xl border border-borde bg-elevada p-4">
                <div className="flex items-center gap-3">
                  <CuadroIcono nombre={d.icono} tamano={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate">{d.nombre}</b>
                    <span className="truncate text-[13px] text-tenue">{d.detalle}</span>
                  </span>
                  <Chip tono={d.estado.tono}>{d.estado.texto}</Chip>
                </div>
                <div>
                  <p className="text-[13px] text-cuerpo">Saldo pendiente</p>
                  <p className="text-2xl leading-[30px] font-bold">{formatearCOP(d.pendiente)}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex-1">
                    <Barra porcentaje={d.porcentaje} tono="marca" gruesa />
                  </span>
                  <b className="text-sm">{d.porcentaje} %</b>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-cuerpo">Acordado</dt>
                    <dd className="font-bold">{formatearCOP(d.monto)}</dd>
                  </div>
                  <div>
                    <dt className="text-cuerpo">Pagado</dt>
                    <dd className="font-bold">{formatearCOP(d.pagado)}</dd>
                  </div>
                  <div>
                    <dt className="text-cuerpo">Cuota</dt>
                    <dd className="font-bold">{d.cuota ? formatearCOP(d.cuota) : "Abonos libres"}</dd>
                  </div>
                  <div>
                    <dt className="text-cuerpo">Fecha límite</dt>
                    <dd className="font-bold">{d.fecha_limite ? formatearFecha(d.fecha_limite) : "—"}</dd>
                  </div>
                </dl>
                {conAbono && d.pendiente > 0 && (
                  <Link href={`/deudas?nuevo=abono-${d.id}`} scroll={false} data-guia="abonar" className={clasesBoton("secundario", "h-9 w-full text-sm")}>
                    Registrar abono
                  </Link>
                )}
              </section>
            ))}
          </div>

          {vencida && (
            <section className="flex items-center gap-3.5 rounded-2xl border border-[#d6e3dd] bg-seleccion p-4 md:p-6">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevada">
                <Icono nombre="meta" tamano={20} />
              </span>
              <p className="flex-1 text-[15px] leading-[22px]">
                Si pagas hoy la cuota vencida de {vencida.nombre}, terminas esa deuda en{" "}
                {formatearMes(sumarMeses(mes, Math.max(0, (vencida.mesesRestantes ?? 1) - 1)))} y liberas <b>{formatearCOP(vencida.cuota!)}</b> al mes desde
                entonces.
              </p>
            </section>
          )}
        </>
      )}

      <TarjetaAcademia
        href="/academia/deudas/bola-de-nieve-o-avalancha"
        icono="deducciones"
        etiqueta="Academia · Deudas sin miedo"
        titulo="Bola de nieve o avalancha: cuál deuda pagar primero"
      />

      {ctx.puedeEditar && (
        <>
          <Ventana titulo="Nueva deuda" subtitulo="Un crédito, una tarjeta o un préstamo con alguien." guia="form-deuda">
            <FormularioDeuda />
          </Ventana>
          {conAbono &&
            filas
              .filter((d) => d.pendiente > 0)
              .map((d) => (
                <Ventana key={d.id} valor={`abono-${d.id}`} titulo={`Abono a ${d.nombre}`} subtitulo={`Pendiente ${formatearCOP(d.pendiente)}. Queda como gasto en Deudas y suma al avance.`} guia="abono">
                  <FormularioAbono deudaId={d.id} cuota={d.cuota} cuentas={cuentas!} />
                </Ventana>
              ))}
        </>
      )}
    </div>
    </>
  );
}
