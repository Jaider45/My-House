import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso, Chip, Titulo } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { TarjetaTabla } from "../../../tarjeta-tabla";

export const metadata: Metadata = { title: "Datos financieros del hogar" };

type Finanzas = {
  vence: string;
  cuentas: { nombre: string; tipo: string; archivada: boolean; saldo: number | null }[];
  movimientos: { fecha: string; comercio: string | null; monto: number; tipo: string; estado: string; origen: string; categoria: string | null; cuenta: string | null }[];
  importaciones: { archivo: string; total: number; importadas: number; duplicadas: number; created_at: string }[];
};

/** Solo lectura, con el permiso vigente del administrador del hogar; cada carga de esta pantalla queda auditada. */
export default async function FinanzasHogar({ params }: PageProps<"/consola/hogares/[id]/finanzas">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const staff = await obtenerStaff();
  const { data, error } = await staff.supabase.rpc("consola_ver_finanzas", { p_hogar: id });
  const volver = (
    <Link href={`/consola/hogares/${id}`} className="text-sm font-semibold underline">
      Volver al hogar
    </Link>
  );
  if (error)
    return (
      <>
        <Titulo registrar={false}>Datos financieros</Titulo>
        <div className="flex flex-col gap-3">
          <Aviso>{mensajeError(error)}</Aviso>
          {volver}
        </div>
      </>
    );
  const f = data as unknown as Finanzas;

  return (
    <>
      <Titulo registrar={false} subtitulo={`Solo lectura · acceso hasta: ${formatearMomento(f.vence).toLowerCase()} · esta vista quedó en la auditoría`} accion={volver}>
        Datos financieros del hogar
      </Titulo>
      <div className="flex flex-col gap-5">
        <TarjetaTabla titulo="Cuentas">
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Cuenta</th>
                <th>Tipo</th>
                <th className="der pr-4! md:pr-6!">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {f.cuentas.map((c, i) => (
                <tr key={i}>
                  <td className="pl-4! md:pl-6!">
                    {c.nombre} {c.archivada && <Chip plano>Archivada</Chip>}
                  </td>
                  <td>{c.tipo}</td>
                  <td className="der pr-4! font-semibold md:pr-6!">{formatearCOP(c.saldo ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
        <TarjetaTabla titulo="Últimos movimientos" subtitulo="Los 100 más recientes">
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Cuenta</th>
                <th>Origen</th>
                <th className="der pr-4! md:pr-6!">Monto</th>
              </tr>
            </thead>
            <tbody>
              {f.movimientos.map((m, i) => (
                <tr key={i}>
                  <td className="pl-4! md:pl-6!">{formatearFecha(m.fecha)}</td>
                  <td>
                    {m.comercio ?? "—"} {m.estado === "programado" && <Chip tono="alerta">Programado</Chip>}
                  </td>
                  <td className="text-cuerpo">{m.categoria ?? "Sin categoría"}</td>
                  <td className="text-cuerpo">{m.cuenta ?? "—"}</td>
                  <td className="text-tenue">{m.origen}</td>
                  <td className={`der pr-4! font-semibold md:pr-6! ${m.tipo === "ingreso" ? "text-ok-tinta" : ""}`}>
                    {m.tipo === "gasto" ? "−" : m.tipo === "ingreso" ? "+" : ""}
                    {formatearCOP(m.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
        {f.importaciones.length > 0 && (
          <TarjetaTabla titulo="Importaciones recientes">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Archivo</th>
                  <th className="der">Filas</th>
                  <th className="der">Importadas</th>
                  <th className="der">Duplicadas</th>
                  <th className="pr-4! md:pr-6!">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {f.importaciones.map((m, i) => (
                  <tr key={i}>
                    <td className="pl-4! md:pl-6!">{m.archivo}</td>
                    <td className="der">{m.total}</td>
                    <td className="der">{m.importadas}</td>
                    <td className="der">{m.duplicadas}</td>
                    <td className="pr-4! md:pr-6!">{formatearMomento(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>
        )}
      </div>
    </>
  );
}
