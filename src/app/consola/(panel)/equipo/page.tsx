import type { Metadata } from "next";
import { Aviso, Chip, Tarjeta, Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta, formatearMomento } from "@/lib/consola/formato";
import { MATRIZ, MINUTOS_INACTIVIDAD, nombreRol, PERMISOS, ROLES_STAFF } from "@/lib/consola/permisos";
import { activarPersona, cambiarRolPersona, cancelarInvitacion } from "./acciones";
import { FormularioInvitar } from "./invitar";
import { TarjetaTabla } from "../tarjeta-tabla";

export const metadata: Metadata = { title: "Equipo y permisos" };

const DOS_PASOS: Record<string, string> = { totp: "App autenticadora", phone: "SMS", webauthn: "Llave de seguridad" };

function Avatar({ nombre }: { nombre: string }) {
  const ini = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mosaico text-xs font-bold text-tinta">
      {ini}
    </span>
  );
}

function Si() {
  return (
    <>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mx-auto text-ok-tinta">
        <path d="M5 12l5 5 9-10" />
      </svg>
      <span className="sr-only">Sí</span>
    </>
  );
}

export default async function EquipoConsola() {
  const staff = await obtenerStaff();
  const gestiona = staff.puede("equipo");
  const [equipo, invitaciones] = await Promise.all([
    staff.supabase.rpc("consola_equipo"),
    gestiona ? staff.supabase.rpc("consola_invitaciones") : Promise.resolve({ data: [], error: null }),
  ]);
  const error = equipo.error ?? invitaciones.error;
  const personas = equipo.data ?? [];
  const activas = personas.filter((p) => p.activo).length;

  return (
    <>
      <Titulo registrar={false} subtitulo="Quién entra a la consola y qué puede hacer">
        Equipo y permisos
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TarjetaTabla titulo="Equipo" subtitulo={`${personas.length} ${personas.length === 1 ? "persona" : "personas"} · ${activas} ${activas === 1 ? "activa" : "activas"}`}>
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Persona</th>
                    <th>Rol</th>
                    <th>2FA</th>
                    <th>Último ingreso</th>
                    <th className="pr-4! md:pr-6!">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => {
                    const yo = p.user_id === staff.userId;
                    return (
                      <tr key={p.user_id} className={p.activo ? undefined : "opacity-60"}>
                        <td className="pl-4! md:pl-6!">
                          <span className="flex items-center gap-2.5">
                            <Avatar nombre={p.nombre} />
                            <span className="flex flex-col leading-[18px]">
                              <b>{yo ? `${p.nombre} (tú)` : p.nombre}</b>
                              <small className="text-xs text-tenue">{p.email}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          {gestiona && !yo && p.activo ? (
                            <FormularioAccion accion={cambiarRolPersona} className="flex items-center gap-2">
                              <input type="hidden" name="usuario" value={p.user_id} />
                              <select name="rol" defaultValue={p.rol} aria-label={`Rol de ${p.nombre}`} className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm">
                                {ROLES_STAFF.map((r) => (
                                  <option key={r.valor} value={r.valor}>
                                    {r.nombre}
                                  </option>
                                ))}
                              </select>
                              <BotonEnviar variante="secundario" className="h-9 px-3 text-sm" pendiente="…">
                                Guardar
                              </BotonEnviar>
                            </FormularioAccion>
                          ) : (
                            <Chip tono={p.rol === "superadmin" ? "info" : "neutro"} plano>
                              {nombreRol(p.rol)}
                            </Chip>
                          )}
                        </td>
                        <td>
                          {p.dos_pasos ? (
                            <Chip tono="ok">{p.dos_pasos.split(",").map((t) => DOS_PASOS[t] ?? t).join(" · ")}</Chip>
                          ) : (
                            <Chip tono="alerta">Pendiente</Chip>
                          )}
                        </td>
                        <td className="text-cuerpo">{yo ? "Ahora" : formatearMomento(p.ultimo_ingreso)}</td>
                        <td className="pr-4! text-right md:pr-6!">
                          {gestiona && !yo ? (
                            <FormularioAccion accion={activarPersona} className="inline-flex justify-end">
                              <input type="hidden" name="usuario" value={p.user_id} />
                              <input type="hidden" name="activo" value={String(!p.activo)} />
                              <BotonEnviar variante={p.activo ? "peligro" : "secundario"} className="h-9 px-3 text-sm" pendiente="…">
                                {p.activo ? "Desactivar" : "Reactivar"}
                              </BotonEnviar>
                            </FormularioAccion>
                          ) : (
                            <span className="text-tenue">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TarjetaTabla>

          {gestiona && (invitaciones.data?.length ?? 0) > 0 && (
            <TarjetaTabla titulo="Invitaciones pendientes"  subtitulo="Vencen a los 7 días">
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="pl-4! md:pl-6!">Persona</th>
                      <th>Rol</th>
                      <th>Invitó</th>
                      <th>Vence</th>
                      <th className="pr-4! md:pr-6!">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitaciones.data!.map((i) => (
                      <tr key={i.id}>
                        <td className="pl-4! md:pl-6!">
                          <span className="flex flex-col leading-[18px]">
                            <b>{i.nombre}</b>
                            <small className="text-xs text-tenue">{i.email}</small>
                          </span>
                        </td>
                        <td>
                          <Chip plano>{nombreRol(i.rol)}</Chip>
                        </td>
                        <td className="text-cuerpo">{i.creada_por ?? "—"}</td>
                        <td className="text-cuerpo">{new Date(i.vence) < new Date() ? <Chip tono="error">Vencida</Chip> : formatearFechaCorta(i.vence)}</td>
                        <td className="pr-4! text-right md:pr-6!">
                          <FormularioAccion accion={cancelarInvitacion} className="inline-flex justify-end">
                            <input type="hidden" name="id" value={i.id} />
                            <BotonEnviar variante="fantasma" className="h-9 px-3 text-sm" pendiente="…">
                              Cancelar
                            </BotonEnviar>
                          </FormularioAccion>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TarjetaTabla>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {gestiona && (
            <Tarjeta titulo="Invitar persona" subtitulo="Le llega un enlace; al entrar activa la verificación en dos pasos.">
              <FormularioInvitar />
            </Tarjeta>
          )}
          <Tarjeta titulo="Políticas de acceso">
            <dl className="flex flex-col text-sm">
              {[
                ["Verificación en dos pasos", "Obligatoria"],
                ["Cerrar sesión por inactividad", `${MINUTOS_INACTIVIDAD} min`],
                ["Correos de otras personas", "Enmascarados"],
                ["Acciones del equipo", "Quedan en la auditoría"],
              ].map(([k, v]) => (
                <div key={k} className="flex min-h-10 items-center justify-between gap-3 border-b border-divisor last:border-0">
                  <dt className="text-cuerpo">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>
        </div>
      </div>

      <TarjetaTabla
        titulo="Roles y permisos"
        subtitulo="Nadie del equipo ve los datos financieros de un hogar sin el permiso de su administrador"
        className="mt-5"
      >
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Permiso</th>
                {ROLES_STAFF.map((r) => (
                  <th key={r.valor} className="text-center!">
                    {r.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISOS.map((p) => (
                <tr key={p.valor}>
                  <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{p.texto}</td>
                  {ROLES_STAFF.map((r) => (
                    <td key={r.valor} className="text-center">
                      {MATRIZ[r.valor].includes(p.valor) ? <Si /> : <span className="text-tenue">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TarjetaTabla>
    </>
  );
}
