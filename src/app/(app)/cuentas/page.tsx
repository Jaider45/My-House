import Link from "next/link";
import { Barra, Boton, Chip, EnlaceBoton, Kpi, Tarjeta, Titulo, Vacio, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { obtenerContexto } from "@/lib/sesion";
import { formatearCOP, porcentaje } from "@/lib/dinero";
import { avanceDeuda } from "@/lib/deudas";
import { archivarCuenta } from "./acciones";
import { BotonEliminarCuenta, FormularioCuenta, type Cuenta } from "./formulario";
import { FormularioAccion } from "@/components/ui/formulario-accion";

export const metadata = { title: "Cuentas y tarjetas" };

const TIPOS: Record<Cuenta["tipo"], { texto: string; filtro: string; icono: NombreIcono }> = {
  banco: { texto: "Banco", filtro: "Bancarias", icono: "cuentas" },
  tarjeta: { texto: "Crédito", filtro: "Tarjetas de crédito", icono: "cuentas" },
  billetera: { texto: "Billetera", filtro: "Billeteras", icono: "conectividad" },
  efectivo: { texto: "Efectivo", filtro: "Efectivo", icono: "ingresos" },
};

export default function Cuentas({ searchParams }: PageProps<"/cuentas">) {
  return (
    <>
      <Titulo subtitulo="Dónde está la plata de la casa y cuánto deben las tarjetas">Cuentas y tarjetas</Titulo>
      <Contenido searchParams={searchParams} />
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto();
  const sp = await searchParams;
  const filtro = typeof sp.tipo === "string" && sp.tipo in TIPOS ? (sp.tipo as Cuenta["tipo"]) : null;
  const editarId = typeof sp.editar === "string" ? sp.editar : null;

  const [{ data: cuentas }, { data: saldos }, { data: miembros }, { data: deudas }, { data: abonos }] = await Promise.all([
    ctx.supabase
      .from("accounts")
      .select("id, tipo, nombre, entidad, ultimos4, saldo_inicial, cupo, dia_corte, dia_pago, titular_member_id, archivada")
      .order("archivada")
      .order("created_at"),
    ctx.supabase.from("account_balances").select("account_id, saldo"),
    ctx.supabase.from("members").select("id, nombre").eq("es_dependiente", false).order("created_at"),
    ctx.supabase.from("debts").select("id, nombre, monto, pagado_inicial, cuota, cuotas_total").eq("archivada", false),
    ctx.supabase.from("transactions").select("debt_id, monto").not("debt_id", "is", null).eq("estado", "confirmado"),
  ]);
  const saldo = new Map(saldos?.map((s) => [s.account_id, s.saldo ?? 0]));
  const titular = new Map(miembros?.map((m) => [m.id, m.nombre.split(" ")[0]]));
  const todas = (cuentas ?? []) as (Cuenta & { archivada: boolean })[];
  const activas = todas.filter((c) => !c.archivada);
  const disponible = activas.filter((c) => c.tipo !== "tarjeta").reduce((s, c) => s + (saldo.get(c.id) ?? 0), 0);
  const tarjetas = activas.filter((c) => c.tipo === "tarjeta");
  const usado = tarjetas.reduce((s, c) => s + Math.max(0, -(saldo.get(c.id) ?? 0)), 0);
  const cupo = tarjetas.reduce((s, c) => s + (c.cupo ?? 0), 0);
  const pagoProximo = tarjetas.map((c) => c.dia_pago).filter(Boolean).sort((a, b) => a! - b!)[0];
  const abonosPor = new Map<string, number>();
  for (const a of abonos ?? []) abonosPor.set(a.debt_id!, (abonosPor.get(a.debt_id!) ?? 0) + a.monto);
  const creditos = (deudas ?? []).map((d) => ({ ...d, ...avanceDeuda({ ...d, abonos: abonosPor.get(d.id) ?? 0 }) })).filter((d) => d.pendiente > 0);
  const visibles = todas.filter((c) => !filtro || c.tipo === filtro);
  const editando = todas.find((c) => c.id === editarId);
  const conteo = (t: Cuenta["tipo"]) => activas.filter((c) => c.tipo === t).length;

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-5">
        <Kpi icono="cuentas" etiqueta="Disponible en cuentas" valor={formatearCOP(disponible)} detalle={`${activas.length - tarjetas.length} cuentas y efectivo`} />
        <Kpi
          icono="egresos"
          etiqueta="Usado en tarjetas"
          valor={formatearCOP(usado)}
          detalle={cupo ? `${porcentaje(usado, cupo)} % del cupo${pagoProximo ? ` · pago el ${pagoProximo}` : ""}` : `${tarjetas.length} tarjetas`}
        />
        <Kpi
          icono="deducciones"
          etiqueta="Créditos activos"
          valor={formatearCOP(creditos.reduce((s, d) => s + d.pendiente, 0))}
          detalle={
            <>
              {creditos.map((d) => d.nombre).join(", ") || "Sin créditos"} ·{" "}
              <Link href="/deudas" className="font-semibold text-tinta underline">
                ver deudas
              </Link>
            </>
          }
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section aria-label="Tus cuentas" className="flex min-w-0 flex-col gap-3.5">
          <nav aria-label="Tipo de cuenta" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <Link href="/cuentas" className={claseFiltro(!filtro)}>
              Todas · {activas.length}
            </Link>
            {(Object.keys(TIPOS) as Cuenta["tipo"][]).map((t) =>
              conteo(t) ? (
                <Link key={t} href={`/cuentas?tipo=${t}`} className={claseFiltro(filtro === t)}>
                  {TIPOS[t].filtro}
                </Link>
              ) : null,
            )}
            <Link href="/deudas" className={claseFiltro(false)}>
              Créditos
            </Link>
          </nav>

          {visibles.length === 0 ? (
            <Vacio icono="cuentas" titulo="Aún no hay cuentas">
              Agrega tu cuenta de ahorros, tus tarjetas y el efectivo de la casa.
            </Vacio>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {visibles.map((c) => {
                const s = saldo.get(c.id) ?? 0;
                const esTarjeta = c.tipo === "tarjeta";
                return (
                  <article key={c.id} className={cx("flex flex-col gap-3 rounded-2xl border border-borde bg-elevada p-5", c.archivada && "opacity-60")}>
                    <div className="flex items-center gap-3">
                      <span
                        className={cx(
                          "inline-flex size-11 shrink-0 items-center justify-center rounded-lg",
                          esTarjeta ? "bg-monte text-arena" : "bg-mosaico text-tinta",
                        )}
                      >
                        <Icono nombre={TIPOS[c.tipo].icono} tamano={22} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate text-base">{c.nombre}</b>
                        <span className="truncate text-[13px] text-tenue">
                          {[c.ultimos4 && `Terminada en ${c.ultimos4}`, c.titular_member_id ? titular.get(c.titular_member_id) : "Compartida"].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Chip plano>{c.archivada ? "Archivada" : TIPOS[c.tipo].texto}</Chip>
                    </div>
                    <div>
                      <span className="text-[13px] text-cuerpo">{esTarjeta ? "Usado este periodo" : c.tipo === "efectivo" ? "En la casa" : "Saldo registrado"}</span>
                      <p className={cx("text-2xl leading-[30px] font-bold", !esTarjeta && s < 0 && "text-error-tinta")}>{formatearCOP(esTarjeta ? Math.max(0, -s) : s)}</p>
                    </div>
                    {esTarjeta && c.cupo && (
                      <div className="flex flex-col gap-1.5">
                        <Barra porcentaje={porcentaje(-s, c.cupo)} tono="teja" />
                        <span className="text-[13px] text-cuerpo">
                          De {formatearCOP(c.cupo)} de cupo{c.dia_corte ? ` · corte el ${c.dia_corte}` : ""}
                          {c.dia_pago ? ` · pago el ${c.dia_pago}` : ""}
                        </span>
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <EnlaceBoton href={`/movimientos?cuenta=${c.id}`} variante="secundario" className="h-9 px-3 text-sm">
                        Movimientos
                      </EnlaceBoton>
                      {ctx.puedeEditar && (
                        <EnlaceBoton href={`/cuentas?editar=${c.id}`} variante="fantasma" className="h-9 px-3 text-sm">
                          Editar
                        </EnlaceBoton>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {ctx.puedeEditar && (
          <Tarjeta
            titulo={editando ? `Editar ${editando.nombre}` : "Agregar cuenta o tarjeta"}
            subtitulo={editando ? undefined : "Solo nombre y últimos 4 dígitos. Nunca te pedimos claves."}
            accion={
              editando && (
                <EnlaceBoton href="/cuentas" variante="fantasma" className="h-9 px-3 text-sm">
                  Cancelar
                </EnlaceBoton>
              )
            }
          >
            <FormularioCuenta key={editando?.id ?? "nueva"} cuenta={editando} titulares={miembros ?? []} />
            {editando && (
              <div className="mt-4 flex flex-col gap-2 border-t border-divisor pt-4">
                <FormularioAccion accion={archivarCuenta}>
                  <input type="hidden" name="id" value={editando.id} />
                  <input type="hidden" name="archivar" value={editando.archivada ? "0" : "1"} />
                  <Boton type="submit" variante="secundario" className="w-full">
                    {editando.archivada ? "Reactivar" : "Archivar"}
                  </Boton>
                </FormularioAccion>
                <BotonEliminarCuenta id={editando.id} />
              </div>
            )}
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

const claseFiltro = (activo: boolean) =>
  cx(
    "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap",
    activo ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico",
  );
