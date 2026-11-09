import { Aviso, Boton, Chip, CuadroIcono, EnlaceBoton, SelectorMes, Tarjeta, Titulo, Vacio, cx, type Tono } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { formatearCOP, formatearCorto } from "@/lib/dinero";
import { formatearDia, formatearFecha, formatearMes, hoy, mesDe, rangoMes, sumarMeses } from "@/lib/fechas";
import { raizDe } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { ETIQUETA_FRECUENCIA, fechasEnRango, montoMensual } from "@/lib/recurrentes";
import { confirmarMovimiento } from "../movimientos/acciones";
import { cambiarEstadoRegla, eliminarRegla } from "./acciones";
import { FormularioRegla } from "./formulario";
import { FormularioAccion } from "@/components/ui/formulario-accion";

export const metadata = { title: "Pagos fijos" };

export default function Recurrentes({ searchParams }: PageProps<"/recurrentes">) {
  return (
    <Contenido searchParams={searchParams} />
  );
}

type Pago = { clave: string; id?: string; nombre: string; fecha: string; monto: number; cuenta: string; icono: ReturnType<typeof iconoCategoria>; estado: "Pagado" | "Pendiente" | "Vencido" | "Programado" };
const TONO: Record<Pago["estado"], Tono> = { Pagado: "ok", Pendiente: "info", Vencido: "error", Programado: "neutro" };
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const formatoHoy = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", timeZone: "UTC" });

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const fecha = hoy();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesDe(fecha);
  const { desde, hasta } = rangoMes(mes);
  const [catalogos, { data: reglas }, { data: generados }] = await Promise.all([
    cargarCatalogos(ctx),
    ctx.supabase
      .from("recurring_rules")
      .select("id, descripcion, monto, tipo, account_id, category_id, frecuencia, fecha_inicio, proxima_fecha, ocurrencias, activa")
      .order("activa", { ascending: false })
      .order("proxima_fecha"),
    ctx.supabase
      .from("transactions")
      .select("id, fecha, monto, comercio, estado, account_id, category_id")
      .eq("tipo", "gasto")
      .not("recurring_rule_id", "is", null)
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);
  const nombreCuenta = new Map(catalogos.cuentas.map((c) => [c.id, c.nombre]));
  const categorias = new Map(catalogos.categorias.map((c) => [c.id, c]));
  const icono = (categoryId: string | null, nombre: string) => iconoCategoria(categoryId ? (raizDe(categorias, categoryId)?.nombre ?? nombre) : nombre);
  const activas = (reglas ?? []).filter((r) => r.activa);
  const gastoMensual = activas.filter((r) => r.tipo === "gasto").reduce((s, r) => s + montoMensual(r.monto, r.frecuencia), 0);

  // Pagos del mes: lo ya programado o pagado por las reglas, más lo que las reglas activas programarán después.
  const pagos: Pago[] = [
    ...(generados ?? []).map((t) => ({
      clave: t.id,
      id: t.estado === "programado" ? t.id : undefined,
      nombre: t.comercio || categorias.get(t.category_id ?? "")?.nombre || "Pago fijo",
      fecha: t.fecha,
      monto: t.monto,
      cuenta: nombreCuenta.get(t.account_id) ?? "",
      icono: icono(t.category_id, t.comercio ?? ""),
      estado: (t.estado === "confirmado" ? "Pagado" : t.fecha < fecha ? "Vencido" : "Pendiente") as Pago["estado"],
    })),
    ...activas
      .filter((r) => r.tipo === "gasto")
      .flatMap((r) =>
        fechasEnRango(r.fecha_inicio, r.frecuencia, r.ocurrencias, desde > fecha ? desde : fecha, hasta).map((f) => ({
          clave: `${r.id}-${f}`,
          nombre: r.descripcion,
          fecha: f,
          monto: r.monto,
          cuenta: nombreCuenta.get(r.account_id) ?? "",
          icono: icono(r.category_id, r.descripcion),
          estado: "Programado" as const,
        })),
      ),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, "es"));

  const total = pagos.reduce((s, p) => s + p.monto, 0);
  const suma = (...e: Pago["estado"][]) => pagos.filter((p) => e.includes(p.estado)).reduce((s, p) => s + p.monto, 0);
  const pagado = suma("Pagado");
  const vencido = suma("Vencido");
  const ancho = (v: number) => `${total ? ((v / total) * 100).toFixed(1) : 0}%`;
  const nombreMes = formatearMes(mes).replace(/ de \d{4}$/, "");

  // Calendario de lunes a domingo.
  const ultimoDia = Number(hasta.slice(8));
  const desfase = (new Date(`${desde}T00:00:00Z`).getUTCDay() + 6) % 7;
  const celdas = [
    ...Array.from({ length: desfase }, () => null),
    ...Array.from({ length: ultimoDia }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (celdas.length % 7) celdas.push(null);
  const porFecha = Map.groupBy(pagos, (p) => p.fecha);

  return (
    <>
      <Titulo
        subtitulo="Lo que la casa paga todos los meses, día por día"
        accion={
          <>
            <SelectorMes etiqueta={formatearMes(mes).replace(" de ", " ")} anterior={`/recurrentes?mes=${sumarMeses(mes, -1)}`} siguiente={`/recurrentes?mes=${sumarMeses(mes, 1)}`} />
            <EnlaceBoton href="/recordatorios" variante="secundario">
              Recordatorios
            </EnlaceBoton>
          </>
        }
      >
        {`Pagos fijos de ${nombreMes}`}
      </Titulo>

      <div className="space-y-4 md:space-y-5">
        <Tarjeta>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-cuerpo">
                Total de pagos fijos del mes · {pagos.length} {pagos.length === 1 ? "pago" : "pagos"}
              </p>
              <p className="text-[32px] leading-[38px] font-bold">{formatearCOP(total)}</p>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <span className="inline-flex items-center gap-2">
                <Chip tono="ok">Pagado</Chip> <b>{formatearCOP(pagado)}</b>
              </span>
              <span className="inline-flex items-center gap-2">
                <Chip tono="info">Pendiente</Chip> <b>{formatearCOP(suma("Pendiente", "Programado"))}</b>
              </span>
              <span className="inline-flex items-center gap-2">
                <Chip tono="error">Vencido</Chip> <b>{formatearCOP(vencido)}</b>
              </span>
            </div>
          </div>
          <div className="mt-3.5 flex h-3 overflow-hidden rounded-full bg-pista">
            <span className="bg-ok" style={{ width: ancho(pagado) }} />
            <span className="bg-error" style={{ width: ancho(vencido) }} />
          </div>
          <p className="mt-3.5 text-[13px] text-tenue">
            Cada día se programan los pagos de los próximos 7 días y aparecen en Movimientos como pendientes hasta que
            los marques como pagados. Equivalente mensual de tus reglas activas: {formatearCOP(gastoMensual)}.
          </p>
        </Tarjeta>

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          <Tarjeta
            className="lg:col-span-2"
            titulo="Calendario"
            accion={mes === mesDe(fecha) ? <span className="text-[13px] text-tenue first-letter:uppercase">Hoy es {formatoHoy.format(new Date(`${fecha}T00:00:00Z`))}</span> : undefined}
          >
            <div className="calendario">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="bg-mosaico py-1.5 text-center text-[11px] font-bold tracking-normal text-cuerpo uppercase md:px-2.5 md:py-2 md:text-left md:text-xs md:tracking-[0.06em]">
                  <span className="md:hidden">{d[0]}</span>
                  <span className="hidden md:inline">{d}</span>
                </div>
              ))}
              {celdas.map((dia, i) =>
                dia ? (
                  <div key={dia} className="flex min-h-[52px] flex-col items-center gap-1 bg-elevada px-0.5 py-1 md:min-h-24 md:items-stretch md:p-1.5 md:pb-2 lg:min-h-28">
                    <span
                      className={cx(
                        "inline-flex size-[26px] items-center justify-center rounded-full text-[13px] font-semibold",
                        dia === fecha ? "bg-monte text-arena" : "text-cuerpo",
                      )}
                    >
                      {Number(dia.slice(8))}
                    </span>
                    {porFecha.get(dia)?.map((p) => (
                      <span
                        key={p.clave}
                        title={`${p.nombre} · ${formatearCOP(p.monto)} · ${p.estado}`}
                        className={cx(
                          "hidden truncate rounded-md px-1.5 py-[3px] text-xs leading-4 font-semibold md:block",
                          { Pagado: "bg-ok-fondo text-ok-tinta", Pendiente: "bg-seleccion text-tinta", Vencido: "bg-error-fondo text-error-tinta", Programado: "bg-mosaico text-cuerpo" }[p.estado],
                        )}
                      >
                        {p.nombre} {formatearCorto(p.monto)}
                      </span>
                    ))}
                    {porFecha.has(dia) && (
                      <span className="flex justify-center gap-[3px] md:hidden">
                        {porFecha.get(dia)!.map((p) => (
                          <i key={p.clave} className={cx("size-1.5 rounded-full", { Pagado: "bg-ok", Pendiente: "bg-cuerpo", Vencido: "bg-error", Programado: "bg-control" }[p.estado])} />
                        ))}
                      </span>
                    )}
                  </div>
                ) : (
                  <div key={`vacio-${i}`} className="bg-pagina" />
                ),
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Lista" accion={<span className="text-[13px] text-tenue">Por fecha</span>}>
            {pagos.length ? (
              pagos.map((p) => (
                <div key={p.clave} className="flex min-h-[60px] items-center gap-3 border-b border-divisor py-2 last:border-b-0">
                  <CuadroIcono nombre={p.icono} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{p.nombre}</span>
                    <span className="truncate text-[13px] text-cuerpo">
                      {p.estado === "Pagado" ? "Pagado el" : p.estado === "Vencido" ? "Venció el" : "Vence el"} {formatearDia(p.fecha)}
                      {p.cuenta && ` · ${p.cuenta}`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <b className="text-[15px] whitespace-nowrap">{formatearCOP(p.monto)}</b>
                    {p.id && ctx.puedeEditar ? (
                      <FormularioAccion accion={confirmarMovimiento}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className={cx("chip cursor-pointer", `chip-${TONO[p.estado]}`)} aria-label={`Marcar ${p.nombre} como pagado`}>
                          {p.estado} · Pagar
                        </button>
                      </FormularioAccion>
                    ) : (
                      <Chip tono={TONO[p.estado]}>{p.estado}</Chip>
                    )}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-tenue">No hay pagos fijos en {nombreMes}.</p>
            )}
          </Tarjeta>
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          <Tarjeta className="lg:col-span-2" titulo="Tus pagos programados" subtitulo="Las reglas que generan los pagos de cada mes">
            {reglas?.length ? (
              <ul>
                {reglas.map((r) => (
                  <li key={r.id} className={cx("border-b border-divisor last:border-b-0", !r.activa && "opacity-60")}>
                    <details className="group py-2">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3">
                        <CuadroIcono nombre={icono(r.category_id, r.descripcion)} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-semibold">{r.descripcion}</span>
                          <span className="truncate text-[13px] text-cuerpo">
                            {ETIQUETA_FRECUENCIA[r.frecuencia]} · {categorias.get(r.category_id)?.nombre} · {nombreCuenta.get(r.account_id) ?? "cuenta archivada"}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <b className={cx("text-[15px] whitespace-nowrap", r.tipo === "ingreso" && "text-ok-tinta")}>{formatearCOP(r.monto)}</b>
                          {r.activa ? <Chip plano>Próximo: {formatearFecha(r.proxima_fecha)}</Chip> : <Chip tono="alerta">Pausada</Chip>}
                        </span>
                      </summary>
                      {ctx.puedeEditar && (
                        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-mosaico p-4">
                          <FormularioRegla regla={r} cuentas={catalogos.cuentas} categorias={catalogos.categorias} hoy={fecha} />
                          <div className="flex flex-wrap gap-3">
                            <FormularioAccion accion={cambiarEstadoRegla}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="activar" value={r.activa ? "0" : "1"} />
                              <Boton type="submit" variante="secundario">
                                {r.activa ? "Pausar" : "Reactivar"}
                              </Boton>
                            </FormularioAccion>
                            <FormularioAccion accion={eliminarRegla}>
                              <input type="hidden" name="id" value={r.id} />
                              <Boton type="submit" variante="peligro">
                                Eliminar regla
                              </Boton>
                            </FormularioAccion>
                          </div>
                        </div>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio>Sin pagos programados todavía. Agrega el arriendo, el colegio o los servicios.</Vacio>
            )}
          </Tarjeta>

          {ctx.puedeEditar &&
            (catalogos.cuentas.length ? (
              <Tarjeta titulo="Nuevo pago fijo">
                <FormularioRegla cuentas={catalogos.cuentas} categorias={catalogos.categorias} hoy={fecha} />
              </Tarjeta>
            ) : (
              <div className="space-y-3">
                <Aviso tipo="info">Primero crea una cuenta.</Aviso>
                <EnlaceBoton href="/cuentas" className="w-full">
                  Crear cuenta
                </EnlaceBoton>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
