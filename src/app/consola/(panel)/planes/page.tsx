import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Tarjeta, Titulo } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta } from "@/lib/consola/formato";
import type { Plan } from "@/lib/planes";
import { TarjetaTabla } from "../tarjeta-tabla";
import { EditorPlan, EditorReglas, FormularioCupon, type Cupon } from "./formularios";

export const metadata: Metadata = { title: "Planes y cupones" };

function textoCupon(c: Cupon) {
  if (c.tipo === "meses_gratis") return `${c.valor} ${c.valor === 1 ? "mes" : "meses"} gratis`;
  return `${c.valor} %${c.periodos ? ` por ${c.periodos} ${c.periodos === 1 ? "cobro" : "cobros"}` : " para siempre"}`;
}

function estadoCupon(c: Cupon) {
  const ahora = new Date();
  if (!c.activo) return <Chip plano>Inactivo</Chip>;
  if (c.usos_max && c.usos >= c.usos_max) return <Chip plano>Agotado</Chip>;
  if (c.hasta && new Date(c.hasta) < ahora) return <Chip plano>Vencido</Chip>;
  if (new Date(c.desde) > ahora) return <Chip tono="alerta">Programado · {formatearFechaCorta(c.desde)}</Chip>;
  return <Chip tono="ok">Activo</Chip>;
}

export default async function PlanesConsola({ searchParams }: PageProps<"/consola/planes">) {
  const staff = await obtenerStaff();
  const { cupon: editar } = await searchParams;
  const [planes, cupones, config] = await Promise.all([
    staff.supabase.rpc("consola_planes"),
    staff.supabase.rpc("consola_cupones"),
    staff.supabase.from("plataforma_config").select("clave, valor"),
  ]);
  const lista = (planes.data ?? []) as unknown as Plan[];
  const cups = (cupones.data ?? []) as unknown as Cupon[];
  const reglas = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));
  const puede = staff.puede("planes");
  const editando = typeof editar === "string" ? cups.find((c) => c.codigo === editar) : undefined;
  const usosMes = cups.reduce((s, c) => s + c.usos, 0);

  return (
    <>
      <Titulo registrar={false} subtitulo="Precios, límites y promociones · precios con IVA incluido">
        Planes y cupones
      </Titulo>
      {(planes.error || cupones.error) && <Aviso>{mensajeError(planes.error ?? cupones.error)}</Aviso>}
      {!puede && (
        <div className="mb-4">
          <Aviso tipo="info">Solo lectura: editar planes, precios y cupones es de Finanzas o un superadmin.</Aviso>
        </div>
      )}
      <p className="mb-4 text-sm text-cuerpo">
        Un precio nuevo rige para los cobros que se creen desde ya (altas y renovaciones). Los límites aplican de inmediato a todos los hogares del plan. Cada
        cambio queda en la auditoría.
      </p>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-3">
        {lista.map((p) => (
          <EditorPlan key={p.codigo} plan={p} puede={puede} />
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <TarjetaTabla titulo="Cupones" subtitulo={`${cups.length} ${cups.length === 1 ? "cupón" : "cupones"} · ${usosMes} usos en total`}>
          {cups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay cupones.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Código</th>
                  <th>Descuento</th>
                  <th>Aplica a</th>
                  <th className="der">Usos</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cups.map((c) => (
                  <tr key={c.codigo}>
                    <td className="pl-4! font-bold md:pl-6!">{c.codigo}</td>
                    <td>{textoCupon(c)}</td>
                    <td className="text-cuerpo">
                      {c.planes.map((x) => lista.find((p) => p.codigo === x)?.nombre ?? x).join(", ")}
                      {c.periodo ? ` ${c.periodo}` : ""}
                    </td>
                    <td className="der">
                      {c.usos} / {c.usos_max ?? "∞"}
                    </td>
                    <td className="text-cuerpo">{c.hasta ? formatearFechaCorta(c.hasta) : "Sin fecha"}</td>
                    <td>{estadoCupon(c)}</td>
                    <td className="pr-4! md:pr-6!">
                      {puede && (
                        <Link href={`/consola/planes?cupon=${encodeURIComponent(c.codigo)}#cupon`} className="font-semibold underline-offset-4 hover:underline">
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <div className="flex min-w-0 flex-col gap-5">
          {puede && (
            <Tarjeta id="cupon" titulo={editando ? `Editar ${editando.codigo}` : "Crear cupón"} accion={editando ? <Link href="/consola/planes#cupon" className="text-sm font-semibold">Nuevo</Link> : undefined}>
              <FormularioCupon cupon={editando} planes={lista.filter((p) => p.precio_mensual > 0).map((p) => ({ codigo: p.codigo, nombre: p.nombre }))} />
            </Tarjeta>
          )}
          <Tarjeta titulo="Reglas de cobro">
            <EditorReglas
              puede={puede}
              reglas={{
                prueba_dias: Number(reglas.prueba_dias ?? 14),
                descuento_anual_visible: reglas.descuento_anual_visible !== false,
                iva_incluido: reglas.iva_incluido !== false,
              }}
            />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
