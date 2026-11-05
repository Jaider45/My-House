import { Suspense } from "react";
import { Boton, Cargando, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearFecha } from "@/lib/fechas";
import { cambiarRol, quitarMiembro, revocarInvitacion } from "../acciones";
import { CopiarEnlace, FormularioDependiente, FormularioInvitar } from "./formularios";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";

export const metadata = { title: "Miembros" };

const ROLES = { admin: "Administrador", editor: "Editor", contador: "Contador" } as const;

export default function Miembros() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/miembros" />
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  const [{ data: miembros }, { data: invitaciones }] = await Promise.all([
    ctx.supabase.from("members").select("id, nombre, rol, user_id, es_dependiente").order("created_at"),
    ctx.esAdmin
      ? ctx.supabase.from("invitations").select("id, email, rol, token, expira_en").is("aceptada_en", null).order("created_at")
      : Promise.resolve({ data: [] as { id: string; email: string; rol: keyof typeof ROLES; token: string; expira_en: string }[] }),
  ]);

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Personas del hogar">
        <ul className="divide-y divide-divisor">
          {miembros?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="block font-medium">
                  {m.nombre}
                  {m.user_id === ctx.userId && <span className="text-tenue"> (usted)</span>}
                </span>
                <span className="text-sm text-tenue">
                  {m.es_dependiente ? "Dependiente" : m.rol ? ROLES[m.rol] : "Sin acceso"}
                </span>
              </span>
              {ctx.esAdmin && m.user_id !== ctx.userId && (
                <span className="flex gap-2">
                  {m.user_id && (
                    <form action={cambiarRol} className="flex gap-1">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="rol" defaultValue={m.rol ?? "editor"} className="rounded-lg border border-control bg-transparent px-2 text-sm">
                        {Object.entries(ROLES).map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <Boton type="submit" variante="secundario" className="min-h-9 px-2 text-xs">
                        Cambiar
                      </Boton>
                    </form>
                  )}
                  <form action={quitarMiembro}>
                    <input type="hidden" name="id" value={m.id} />
                    <Boton type="submit" variante="peligro" className="min-h-9 px-2 text-xs">
                      Quitar
                    </Boton>
                  </form>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Tarjeta>

      {ctx.esAdmin && (
        <>
          <Tarjeta titulo="Invitar a alguien">
            <FormularioInvitar />
          </Tarjeta>
          <Tarjeta titulo="Invitaciones pendientes">
            {invitaciones?.length ? (
              <ul className="space-y-3">
                {invitaciones.map((i) => (
                  <li key={i.id} className="space-y-2">
                    <p className="text-sm">
                      <strong>{i.email}</strong> · {ROLES[i.rol]} · vence {formatearFecha(i.expira_en.slice(0, 10))}
                    </p>
                    <CopiarEnlace enlace={`${process.env.NEXT_PUBLIC_SITE_URL}/invitacion/${i.token}`} />
                    <form action={revocarInvitacion}>
                      <input type="hidden" name="id" value={i.id} />
                      <Boton type="submit" variante="peligro" className="min-h-9 text-xs">
                        Revocar
                      </Boton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio>No hay invitaciones pendientes.</Vacio>
            )}
          </Tarjeta>
          <Tarjeta titulo="Agregar dependiente">
            <FormularioDependiente />
          </Tarjeta>
        </>
      )}
    </div>
  );
}
