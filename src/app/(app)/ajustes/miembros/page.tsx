import { Suspense } from "react";
import { Boton, Cargando, Chip, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { formatearFecha, hoy } from "@/lib/fechas";
import { edad, PARENTESCOS, type Parentesco } from "@/lib/hogar";
import { jurisdiccion } from "@/lib/impuestos/registro";
import { cambiarRol, quitarMiembro, revocarInvitacion } from "../acciones";
import { CopiarEnlace, FormularioInvitar, FormularioPersona } from "./formularios";
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
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const [{ data: miembros }, { data: invitaciones }] = await Promise.all([
    ctx.supabase
      .from("members")
      .select("id, nombre, rol, user_id, es_dependiente, parentesco, fecha_nacimiento, a_cargo_de, nota, dependiente_dian")
      .order("created_at"),
    ctx.esAdmin
      ? ctx.supabase.from("invitations").select("id, email, rol, token, expira_en").is("aceptada_en", null).order("created_at")
      : Promise.resolve({ data: [] as { id: string; email: string; rol: keyof typeof ROLES; token: string; expira_en: string }[] }),
  ]);
  const todos = miembros ?? [];
  const adultos = todos.filter((m) => !m.es_dependiente);
  const aCargo = todos.filter((m) => m.es_dependiente);
  const nombreDe = new Map(todos.map((m) => [m.id, m.nombre]));
  const dependientes = jurisdiccion(ctx.hogar.pais)?.dependientes;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Tarjeta titulo="Adultos del hogar" subtitulo="Entran a la app con su propia cuenta">
          <ul className="divide-y divide-divisor">
            {adultos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="block font-medium">
                    {m.nombre}
                    {m.user_id === ctx.userId && <span className="text-tenue"> (tú)</span>}
                  </span>
                  <span className="text-sm text-tenue">{m.rol ? ROLES[m.rol] : "Sin acceso"}</span>
                </span>
                {ctx.esAdmin && m.user_id !== ctx.userId && (
                  <span className="flex gap-2">
                    {m.user_id && (
                      <form action={cambiarRol} className="flex gap-1">
                        <input type="hidden" name="id" value={m.id} />
                        <select name="rol" aria-label={`Rol de ${m.nombre}`} defaultValue={m.rol ?? "editor"} className="rounded-lg border border-control bg-transparent px-2 text-sm">
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
          </>
        )}
      </div>

      <div className="space-y-4">
        <Tarjeta
          titulo="Personas a cargo"
          subtitulo="Hijos, padres u otros familiares que dependen del hogar. Cuentan en el costo por persona y le dan contexto al asistente."
        >
          {aCargo.length ? (
            <ul className="divide-y divide-divisor">
              {aCargo.map((p) => {
                const anios = p.fecha_nacimiento ? edad(p.fecha_nacimiento, fecha) : null;
                const guia = dependientes?.orientacion({ parentesco: p.parentesco as Parentesco | null, edad: anios });
                const detalle = [
                  p.parentesco ? PARENTESCOS[p.parentesco as Parentesco] : null,
                  anios !== null ? `${anios} ${anios === 1 ? "año" : "años"}` : null,
                  p.a_cargo_de ? `a cargo de ${nombreDe.get(p.a_cargo_de) ?? "—"}` : null,
                ].filter(Boolean);
                return (
                  <li key={p.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span>
                        <span className="block font-medium">{p.nombre}</span>
                        <span className="text-sm text-tenue">{detalle.length ? detalle.join(" · ") : "Persona a cargo"}</span>
                        {p.nota && <span className="block text-sm text-cuerpo">{p.nota}</span>}
                      </span>
                      {p.dependiente_dian && <Chip tono="info">Dependiente DIAN</Chip>}
                    </div>
                    {guia && (
                      <p className="text-[13px] leading-[18px] text-cuerpo">
                        <b>¿Cuenta como dependiente para la DIAN?</b> {guia.texto}
                      </p>
                    )}
                    {ctx.esAdmin && (
                      <details className="rounded-xl bg-mosaico p-3">
                        <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                        <div className="mt-3 space-y-3">
                          <FormularioPersona persona={p} adultos={adultos} hoy={fecha} />
                          <form action={quitarMiembro}>
                            <input type="hidden" name="id" value={p.id} />
                            <Boton type="submit" variante="peligro" className="min-h-9 w-full text-xs">
                              Quitar a {p.nombre}
                            </Boton>
                          </form>
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vacio>Aún no hay personas a cargo.</Vacio>
          )}
        </Tarjeta>
        {ctx.esAdmin && (
          <Tarjeta titulo="Agregar persona a cargo">
            <FormularioPersona adultos={adultos} hoy={fecha} />
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
