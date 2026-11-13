import type { Metadata } from "next";
import Link from "next/link";
import { Chip, Titulo } from "@/components/ui";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { TarjetaTabla } from "../tarjeta-tabla";

export const metadata: Metadata = { title: "Buscar" };

type Cobro = { id: string; referencia: string; hogar_id: string; hogar: string; monto: number; estado: string; creado: string };

/** Búsqueda de la franja: hogares (nombre, administrador o correo), personas y cobros por referencia. */
export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await obtenerStaff();
  const q = String((await searchParams).q ?? "").trim().slice(0, 80);
  const [hogares, usuarios, cobros] =
    q.length >= 2
      ? await Promise.all([
          staff.supabase.rpc("consola_hogares", { p_buscar: q, p_limite: 10 }),
          staff.supabase.rpc("consola_usuarios", { p_buscar: q, p_limite: 10 }),
          staff.supabase.rpc("consola_buscar_cobros", { p_q: q }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  const listaCobros = (cobros.data ?? []) as Cobro[];
  const total = (hogares.data?.length ?? 0) + (usuarios.data?.length ?? 0) + listaCobros.length;
  return (
    <>
      <Titulo registrar={false} subtitulo={q.length >= 2 ? `${total} ${total === 1 ? "resultado" : "resultados"} para «${q}»` : "Escribe al menos 2 letras en el buscador de arriba"}>
        Buscar
      </Titulo>
      <div className="flex flex-col gap-5">
        {!!hogares.data?.length && (
          <TarjetaTabla titulo="Hogares">
            <table className="tabla">
              <tbody>
                {hogares.data.map((h) => (
                  <tr key={h.id}>
                    <td className="pl-4! md:pl-6!">
                      <Link href={`/consola/hogares/${h.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {h.nombre}
                      </Link>
                      <br />
                      <span className="text-[13px] text-tenue">{h.admin_nombre}</span>
                    </td>
                    <td>
                      <Chip tono="info">{h.plan_efectivo}</Chip>
                    </td>
                    <td className="pr-4! text-cuerpo md:pr-6!">{h.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>
        )}
        {!!usuarios.data?.length && (
          <TarjetaTabla titulo="Personas" subtitulo="Correos enmascarados">
            <table className="tabla">
              <tbody>
                {usuarios.data.map((u) => (
                  <tr key={`${u.user_id}-${u.hogar_id}`}>
                    <td className="pl-4! md:pl-6!">
                      <b>{u.nombre}</b>
                      <br />
                      <span className="text-[13px] text-tenue">{u.email}</span>
                    </td>
                    <td>
                      {u.hogar_id ? (
                        <Link href={`/consola/hogares/${u.hogar_id}`} className="underline-offset-4 hover:underline">
                          {u.hogar}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pr-4! text-cuerpo md:pr-6!">{u.es_equipo ? "Equipo" : u.rol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>
        )}
        {!!listaCobros.length && (
          <TarjetaTabla titulo="Cobros">
            <table className="tabla">
              <tbody>
                {listaCobros.map((c) => (
                  <tr key={c.id}>
                    <td className="pl-4! font-mono text-[13px] md:pl-6!">{c.referencia}</td>
                    <td>
                      <Link href={`/consola/hogares/${c.hogar_id}`} className="underline-offset-4 hover:underline">
                        {c.hogar}
                      </Link>
                    </td>
                    <td className="der">{formatearCOP(c.monto)}</td>
                    <td>{c.estado}</td>
                    <td className="pr-4! text-cuerpo md:pr-6!">{formatearMomento(c.creado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TarjetaTabla>
        )}
        {q.length >= 2 && total === 0 && <p className="text-sm text-tenue">Nada coincide. Prueba con el nombre del hogar, el correo completo o la referencia del cobro (MH-…).</p>}
      </div>
    </>
  );
}
