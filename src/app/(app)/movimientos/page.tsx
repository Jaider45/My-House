import Link from "next/link";
import { Boton, Chip, CuadroIcono, EnlaceBoton, SelectorMes, Titulo, Vacio, cx, type Tono } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { cargarCatalogos } from "@/lib/catalogos";
import { formatearCOP } from "@/lib/dinero";
import {
  formatearDia,
  formatearMes,
  hoy,
  mesDe,
  rangoMes,
  sumarMeses,
} from "@/lib/fechas";
import { opcionesCategoria, raizDe } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { confirmarMovimiento } from "./acciones";
import { FormularioAccion } from "@/components/ui/formulario-accion";

export const metadata = { title: "Movimientos" };

type Params = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";
const mesValido = (sp: Params) =>
  /^\d{4}-\d{2}$/.test(texto(sp.mes)) ? texto(sp.mes) : null;

const formatoDiaLargo = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const diaLargo = (fecha: string, hoyISO: string) => {
  const t = formatoDiaLargo
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(",", "");
  return fecha === hoyISO
    ? `Hoy · ${t.replace(/^\S+ /, "")}`
    : t.charAt(0).toUpperCase() + t.slice(1);
};

export default function Movimientos({
  searchParams,
}: PageProps<"/movimientos">) {
  return (
    <Contenido searchParams={searchParams} />
  );
}

const claseFiltro =
  "h-9 rounded-full border border-control bg-elevada px-3 text-sm text-tinta outline-none focus:border-monte data-[on=true]:border-monte data-[on=true]:bg-monte data-[on=true]:text-arena";

async function Contenido({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const hoyISO = hoy();
  const mes = mesValido(sp) ?? mesDe(hoyISO);
  // Se validan antes de ir a la consulta: `cuenta` se interpola en un filtro `or` de PostgREST.
  const uuid = (v: string) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "");
  const cuenta = uuid(texto(sp.cuenta));
  const categoria = texto(sp.categoria) === "sin" ? "sin" : uuid(texto(sp.categoria));
  const ambito = ["personal", "negocio"].includes(texto(sp.ambito)) ? (texto(sp.ambito) as "personal" | "negocio") : "";
  const buscar = texto(sp.q).trim().slice(0, 80);
  const tipo = ["ingreso", "gasto", "transferencia"].includes(texto(sp.tipo))
    ? (texto(sp.tipo) as "ingreso" | "gasto" | "transferencia")
    : "";
  const { desde, hasta } = rangoMes(mes);
  // Los catálogos y los movimientos van en paralelo (un viaje a la base en vez de dos). Solo el filtro por
  // categoría necesita los catálogos antes (para sumar las subcategorías). Ver docs/MEJORAS.md («Rendimiento React»).
  const pidiendoCatalogos = cargarCatalogos(ctx);

  let consulta = ctx.supabase
    .from("transactions")
    .select(
      "id, tipo, fecha, monto, comercio, estado, account_id, cuenta_destino_id, category_id, member_id, tax_tag_id, ambito",
    )
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (cuenta)
    consulta = consulta.or(
      `account_id.eq.${cuenta},cuenta_destino_id.eq.${cuenta}`,
    );
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (ambito) consulta = consulta.eq("ambito", ambito);
  if (buscar)
    consulta = consulta.ilike(
      "comercio",
      `%${buscar.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
    );
  if (categoria === "sin") {
    consulta = consulta.is("category_id", null).neq("tipo", "transferencia");
  } else if (categoria) {
    const hijas = (await pidiendoCatalogos).categorias
      .filter((c) => c.padre_id === categoria)
      .map((c) => c.id);
    consulta = consulta.in("category_id", [categoria, ...hijas]);
  }
  const [catalogos, { data: movimientos }] = await Promise.all([pidiendoCatalogos, consulta]);

  const cuentaPorId = new Map(catalogos.cuentas.map((c) => [c.id, c]));
  const miembroPorId = new Map(catalogos.miembros.map((m) => [m.id, m.nombre]));
  const etiquetaPorId = new Map(
    catalogos.etiquetas.map((e) => [e.id, e.nombre]),
  );
  const categoriaPorId = new Map(catalogos.categorias.map((c) => [c.id, c]));
  const etiquetaCat = new Map(
    [
      ...opcionesCategoria(catalogos.categorias, "gasto"),
      ...opcionesCategoria(catalogos.categorias, "ingreso"),
    ].map((o) => [o.id, o.etiqueta]),
  );
  for (const c of catalogos.categorias)
    if (!etiquetaCat.has(c.id)) etiquetaCat.set(c.id, c.nombre);

  const lista = (movimientos ?? []).map((m) => {
    const raiz = m.category_id
      ? raizDe(categoriaPorId, m.category_id)
      : undefined;
    const origen = cuentaPorId.get(m.account_id)?.nombre ?? "?";
    const transferencia = m.tipo === "transferencia";
    const situacion: { texto: string; tono: Tono } =
      m.estado === "programado"
        ? m.fecha < hoyISO
          ? { texto: "Vencido", tono: "error" }
          : { texto: "Pendiente", tono: "info" }
        : {
            texto:
              m.tipo === "ingreso"
                ? "Recibido"
                : transferencia
                  ? "Hecha"
                  : "Pagado",
            tono: "ok",
          };
    return {
      ...m,
      concepto: transferencia
        ? `${origen} → ${cuentaPorId.get(m.cuenta_destino_id ?? "")?.nombre ?? "?"}`
        : m.comercio || etiquetaCat.get(m.category_id ?? "") || "Sin concepto",
      categoria: transferencia
        ? "Transferencia"
        : (etiquetaCat.get(m.category_id ?? "") ?? "Sin categoría"),
      icono: transferencia
        ? ("cuentas" as const)
        : iconoCategoria(
            raiz?.nombre,
            m.tipo === "ingreso" ? "ingreso" : "gasto",
          ),
      cuenta: origen,
      miembro:
        miembroPorId.get(
          m.member_id ?? cuentaPorId.get(m.account_id)?.titular_member_id ?? "",
        ) ?? "—",
      dian: m.tax_tag_id ? (etiquetaPorId.get(m.tax_tag_id) ?? "—") : "—",
      signo: m.tipo === "ingreso" ? "+" : m.tipo === "gasto" ? "−" : "",
      situacion,
    };
  });
  const suma = (t: string, e: string) =>
    lista
      .filter((m) => m.tipo === t && m.estado === e)
      .reduce((s, m) => s + m.monto, 0);
  const porPagar = lista
    .filter((m) => m.tipo === "gasto" && m.situacion.texto !== "Pagado")
    .reduce((s, m) => s + m.monto, 0);
  const porDia = Map.groupBy(lista, (m) => m.fecha);

  const filtros = new URLSearchParams({
    ...(cuenta && { cuenta }),
    ...(categoria && { categoria }),
    ...(tipo && { tipo }),
    ...(ambito && { ambito }),
    ...(buscar && { q: buscar }),
  });
  const enlaceMes = (m: string) =>
    `/movimientos?${new URLSearchParams({ mes: m, ...Object.fromEntries(filtros) })}`;
  const nombreMes = formatearMes(mes).replace(/ de \d{4}$/, "");

  return (
    <>
      <Titulo
        subtitulo="Todo lo que entra y sale de la casa"
        accion={
          <>
            <SelectorMes
              etiqueta={formatearMes(mes).replace(" de ", " ")}
              anterior={enlaceMes(sumarMeses(mes, -1))}
              siguiente={enlaceMes(sumarMeses(mes, 1))}
            />
            <span className="hidden md:contents">
              <EnlaceBoton href="/importar" variante="secundario">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />
                </svg>
                Importar extracto
              </EnlaceBoton>
            </span>
          </>
        }
      >
        {`Movimientos de ${nombreMes}`}
      </Titulo>

      <div className="space-y-4">
        <form
          action="/movimientos"
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="mes" value={mes} />
          <label className="relative flex min-w-0 flex-[1_1_100%] items-center md:max-w-[420px] md:flex-[1_1_280px]">
            <span className="sr-only">Buscar movimientos</span>
            <svg
              className="absolute left-3 text-tenue"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={buscar}
              placeholder="Buscar comercio o concepto"
              className="h-11 w-full rounded-lg border border-control bg-elevada pr-3 pl-[38px] text-[15px] outline-none focus:border-monte"
            />
          </label>
          <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:p-0">
            <select
              name="tipo"
              defaultValue={tipo}
              aria-label="Tipo"
              data-on={!!tipo}
              className={claseFiltro}
            >
              <option value="">Tipo: todos</option>
              <option value="gasto">Gastos</option>
              <option value="ingreso">Ingresos</option>
              <option value="transferencia">Transferencias</option>
            </select>
            <select
              name="ambito"
              defaultValue={ambito}
              aria-label="Ámbito"
              data-on={!!ambito}
              className={claseFiltro}
            >
              <option value="">Personal y negocio</option>
              <option value="personal">Solo personal</option>
              <option value="negocio">Solo negocio</option>
            </select>
            <select
              name="categoria"
              defaultValue={categoria}
              aria-label="Categoría"
              data-on={!!categoria}
              className={claseFiltro}
            >
              <option value="">Categoría: todas</option>
              <option value="sin">Sin categoría</option>
              {catalogos.categorias
                .filter((c) => !c.padre_id)
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
            <select
              name="cuenta"
              defaultValue={cuenta}
              aria-label="Cuenta"
              data-on={!!cuenta}
              className={claseFiltro}
            >
              <option value="">Cuenta: todas</option>
              {catalogos.cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <Boton
              type="submit"
              variante="secundario"
              className="h-9 shrink-0 px-3 text-sm"
            >
              Filtrar
            </Boton>
            {filtros.size > 0 && (
              <EnlaceBoton
                href={`/movimientos?mes=${mes}`}
                variante="fantasma"
                className="h-9 shrink-0 px-3 text-sm"
              >
                Limpiar filtros
              </EnlaceBoton>
            )}
          </div>
        </form>

        {lista.length === 0 ? (
          <Vacio
            icono="cuentas"
            titulo={
              filtros.size
                ? "Ningún movimiento coincide con los filtros"
                : `Aún no hay movimientos en ${nombreMes}`
            }
            acciones={
              <>
                <EnlaceBoton href="/rapido">Registrar un gasto</EnlaceBoton>
                <EnlaceBoton href="/importar" variante="secundario">
                  Importar extracto
                </EnlaceBoton>
              </>
            }
          >
            Registra un gasto en segundos o trae todo el mes de una vez con el
            extracto (CSV o PDF) de tu banco. Los pagos fijos del mes aparecen aquí
            cuando se programan.
          </Vacio>
        ) : (
          <>
            <p className="flex flex-wrap gap-4 text-sm text-cuerpo">
              <b className="text-tinta">
                {lista.length}{" "}
                {lista.length === 1 ? "movimiento" : "movimientos"}
              </b>
              <span>
                Ingresos{" "}
                <b className="text-ok-tinta">
                  {formatearCOP(suma("ingreso", "confirmado"))}
                </b>
              </span>
              <span>
                Gastos{" "}
                <b className="text-tinta">
                  {formatearCOP(suma("gasto", "confirmado"))}
                </b>
              </span>
              {porPagar > 0 && (
                <span>
                  Por pagar{" "}
                  <b className="text-tinta">{formatearCOP(porPagar)}</b>
                </span>
              )}
            </p>

            <div className="hidden overflow-x-auto rounded-2xl border border-borde bg-elevada md:block">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Categoría</th>
                    <th className="der">Monto</th>
                    <th className="hidden lg:table-cell">Cuenta</th>
                    <th className="hidden xl:table-cell">Miembro</th>
                    <th className="hidden xl:table-cell">Etiqueta DIAN</th>
                    <th>Estado</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((m) => (
                    <tr
                      key={m.id}
                      className={
                        m.situacion.tono === "error" ? "bg-crema" : undefined
                      }
                    >
                      <td className="text-cuerpo">{formatearDia(m.fecha)}</td>
                      <td className="max-w-[260px] truncate font-semibold">
                        {m.concepto}
                        {m.ambito === "negocio" && (
                          <span className="ml-2 align-middle">
                            <Chip tono="neutro">Negocio</Chip>
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <CuadroIcono nombre={m.icono} tamano={28} />
                          <span className="max-w-[200px] truncate">
                            {m.categoria}
                          </span>
                        </span>
                      </td>
                      <td
                        className={cx(
                          "der",
                          m.tipo === "ingreso" && "font-semibold text-ok-tinta",
                        )}
                      >
                        {m.signo}
                        {formatearCOP(m.monto)}
                      </td>
                      <td className="hidden text-cuerpo lg:table-cell">
                        {m.cuenta}
                      </td>
                      <td className="hidden text-cuerpo xl:table-cell">
                        {m.miembro}
                      </td>
                      <td className="hidden text-cuerpo xl:table-cell">
                        {m.dian}
                      </td>
                      <td>
                        <Chip tono={m.situacion.tono}>{m.situacion.texto}</Chip>
                      </td>
                      <td>
                        <span className="flex items-center justify-end gap-1">
                          {m.situacion.tono !== "ok" && ctx.puedeEditar && (
                            <BotonConfirmar
                              id={m.id}
                              ingreso={m.tipo === "ingreso"}
                            />
                          )}
                          <Link
                            href={`/movimientos/${m.id}`}
                            aria-label={`Editar ${m.concepto}`}
                            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-mosaico"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M4 20h4L19 9l-4-4L4 16z" />
                            </svg>
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              {[...porDia.entries()].map(([fecha, items]) => (
                <section key={fecha} className="flex flex-col gap-2">
                  <h2 className="mt-2 text-[13px] leading-[18px] font-bold text-cuerpo">
                    {diaLargo(fecha, hoyISO)}
                  </h2>
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className="flex min-h-16 items-center gap-3 rounded-[14px] border border-borde bg-elevada px-3.5 py-3"
                    >
                      <Link
                        href={`/movimientos/${m.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <CuadroIcono nombre={m.icono} tamano={40} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[15px] leading-5 font-semibold">
                            {m.concepto}
                          </span>
                          <span className="truncate text-[13px] leading-[18px] text-tenue">
                            {m.categoria} · {m.cuenta}
                            {m.ambito === "negocio" && " · Negocio"}
                          </span>
                        </span>
                      </Link>
                      <span className="flex flex-col items-end gap-1 text-[15px] font-bold whitespace-nowrap">
                        <span
                          className={
                            m.tipo === "ingreso" ? "text-ok-tinta" : undefined
                          }
                        >
                          {m.signo}
                          {formatearCOP(m.monto)}
                        </span>
                        {m.situacion.tono !== "ok" && ctx.puedeEditar ? (
                          <BotonConfirmar
                            id={m.id}
                            ingreso={m.tipo === "ingreso"}
                            etiqueta={m.situacion.texto}
                            tono={m.situacion.tono}
                          />
                        ) : (
                          <Chip tono={m.situacion.tono}>
                            {m.situacion.texto}
                          </Chip>
                        )}
                      </span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Confirma un movimiento programado ("Pagar" / "Recibir"). */
function BotonConfirmar({
  id,
  ingreso,
  etiqueta,
  tono = "info",
}: {
  id: string;
  ingreso: boolean;
  etiqueta?: string;
  tono?: Tono;
}) {
  return (
    <FormularioAccion accion={confirmarMovimiento}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={cx("chip cursor-pointer", `chip-${tono}`)}
        aria-label={ingreso ? "Marcar como recibido" : "Marcar como pagado"}
      >
        {etiqueta ? `${etiqueta} · ` : ""}
        {ingreso ? "Recibir" : "Pagar"}
      </button>
    </FormularioAccion>
  );
}
