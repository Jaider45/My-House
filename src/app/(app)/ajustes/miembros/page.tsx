import Link from "next/link";
import { AccionPrincipal, Boton, Chip, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { Ventana } from "@/components/ui/ventana";
import { obtenerContexto } from "@/lib/sesion";
import { formatearFecha } from "@/lib/fechas";
import { nombreRol, ROLES_HOGAR, type RolHogar } from "@/lib/hogar/constantes";
import { cambiarRol, quitarMiembro, revocarInvitacion } from "../acciones";
import { CopiarEnlace, FormularioInvitar } from "./formularios";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonGuia } from "@/components/guia/boton-guia";

export const metadata = { title: "Miembros" };


export default function Miembros() {
  return <Contenido />;
}

async function Contenido() {
  const ctx = await obtenerContexto();
  const [{ data: miembros }, { data: invitaciones }] = await Promise.all([
    ctx.supabase
      .from("members")
      .select("id, nombre, rol, user_id")
      .eq("es_dependiente", false)
      .order("created_at"),
    ctx.esAdmin
      ? ctx.supabase.from("invitations").select("id, email, telefono, rol, token, expira_en").is("aceptada_en", null).order("created_at")
      : Promise.resolve({ data: [] as { id: string; email: string | null; telefono: string | null; rol: RolHogar; token: string; expira_en: string }[] }),
  ]);
  const todos = miembros ?? [];
  const adultos = todos;

  return (
    <>
    <Titulo
      subtitulo="El hogar, quién entra, con qué cuentas y con qué valores"
      accion={
        <>
          <BotonGuia id="invitar">Cómo invitar</BotonGuia>
          {ctx.esAdmin && (
            <AccionPrincipal href="/ajustes/miembros?nuevo=1" guia="invitar-miembro">
              Invitar miembro
            </AccionPrincipal>
          )}
        </>
      }
    >
      Configuración
    </Titulo>
    <PestanasConfiguracion actual="/ajustes/miembros" />
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Tarjeta
          titulo="Adultos del hogar"
          subtitulo="Entran a la app con su propia cuenta"
          accion={
            <Link href="/ajustes/personas" className="text-sm font-semibold underline-offset-4 hover:underline">
              Personas a cargo ›
            </Link>
          }
        >
          <ul className="divide-y divide-divisor">
            {adultos.map((m) => (
              <li key={m.id} className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 flex-[1_1_200px] items-center gap-3.5">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-monte text-sm font-bold text-arena">
                    {m.nombre
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[15px]">
                      {m.nombre}
                      {m.user_id === ctx.userId && <span className="font-normal text-tenue"> (tú)</span>}
                    </b>
                    <Chip tono={m.rol ? ROLES_HOGAR[m.rol].tono : "neutro"}>{m.rol ? nombreRol(m.rol) : "Sin acceso"}</Chip>
                  </span>
                </span>
                {ctx.esAdmin && m.user_id !== ctx.userId && (
                  <span className="flex gap-2">
                    {m.user_id && (
                      <FormularioAccion accion={cambiarRol} className="flex gap-1">
                        <input type="hidden" name="id" value={m.id} />
                        <select name="rol" aria-label={`Rol de ${m.nombre}`} defaultValue={m.rol ?? "editor"} className="rounded-lg border border-control bg-transparent px-2 text-sm">
                          {Object.entries(ROLES_HOGAR).map(([v, t]) => (
                            <option key={v} value={v}>
                              {t.nombre}
                            </option>
                          ))}
                        </select>
                        <Boton type="submit" variante="secundario" className="min-h-9 px-2 text-xs">
                          Cambiar
                        </Boton>
                      </FormularioAccion>
                    )}
                    <FormularioAccion accion={quitarMiembro}>
                      <input type="hidden" name="id" value={m.id} />
                      <Boton type="submit" variante="peligro" className="min-h-9 px-2 text-xs">
                        Quitar
                      </Boton>
                    </FormularioAccion>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>

        {ctx.esAdmin && (
          <>
            <Ventana titulo="Invitar a alguien al hogar" subtitulo="Todos ven el mismo hogar; el rol decide qué puede cambiar." guia="invitar">
              <FormularioInvitar />
            </Ventana>
            <Tarjeta
              guia="invitaciones"
              titulo="Invitaciones pendientes"
              accion={
                <Link href="/ajustes/miembros?nuevo=1" scroll={false} data-guia="invitar-miembro" className="inline-flex h-9 items-center rounded-lg border border-cuerpo px-3 text-sm font-semibold hover:bg-mosaico md:hidden">
                  Invitar
                </Link>
              }
            >
              {invitaciones?.length ? (
                <ul className="space-y-3">
                  {invitaciones.map((i) => (
                    <li key={i.id} className="space-y-2">
                      <p className="text-sm">
                        <strong>{i.email ?? i.telefono}</strong> · {nombreRol(i.rol)} · vence {formatearFecha(i.expira_en.slice(0, 10))}
                      </p>
                      <CopiarEnlace enlace={`${process.env.NEXT_PUBLIC_SITE_URL}/invitacion/${i.token}`} />
                      <FormularioAccion accion={revocarInvitacion}>
                        <input type="hidden" name="id" value={i.id} />
                        <Boton type="submit" variante="peligro" className="min-h-9 text-xs">
                          Revocar
                        </Boton>
                      </FormularioAccion>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio>No hay invitaciones pendientes.</Vacio>
              )}
            </Tarjeta>
          </>
        )}
      </div>

    </div>
    </>
  );
}
