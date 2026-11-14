import { headers } from "next/headers";
import { IpsPermitidas } from "./ips";
import type { Metadata } from "next";
import { Aviso, Chip, Tarjeta, Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta, formatearMomento } from "@/lib/consola/formato";
import Link from "next/link";
import { Ventana } from "@/components/ui/ventana";
import { MATRIZ, MINUTOS_INACTIVIDAD, nombreRol, PERMISOS, ROLES_STAFF } from "@/lib/consola/permisos";
import { activarPersona, cambiarRolPersona, cancelarInvitacion } from "./acciones";
import { FormularioInvitar, OpcionesRol } from "./invitar";
import { FormularioInactividad, FormularioMiCelular, FormularioRol, type RolPropio } from "./formularios";
import { MisLlaves } from "../../llave";
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
  const [{ data: filaIps }, h] = await Promise.all([staff.supabase.from("plataforma_config").select("valor").eq("clave", "consola_ips").maybeSingle(), headers()]);
  const ips = ((filaIps?.valor ?? { activo: false, ips: [] }) as { activo: boolean; ips: string[] });
  const miIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const gestiona = staff.puede("equipo");
  const [equipo, invitaciones, roles, factores, contacto, sesion] = await Promise.all([
    staff.supabase.rpc("consola_equipo"),
    gestiona ? staff.supabase.rpc("consola_invitaciones") : Promise.resolve({ data: [], error: null }),
    staff.supabase.rpc("consola_roles"),
    staff.supabase.auth.mfa.listFactors(),
    staff.supabase.from("contactos").select("telefono, whatsapp").eq("user_id", staff.userId).maybeSingle(),
    staff.supabase.from("plataforma_config").select("valor").eq("clave", "consola_sesion").maybeSingle(),
  ]);
  const propios = (roles.data ?? []) as RolPropio[];
  const llaves = (factores.data?.all ?? []).filter((f) => f.factor_type === "webauthn" && f.status === "verified").map((f) => ({ id: f.id, nombre: f.friendly_name ?? null }));
  const minutos = Number((sesion.data?.valor as { minutos?: number } | null)?.minutos ?? MINUTOS_INACTIVIDAD);
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
                              <select name="rol" defaultValue={p.rol_personal ? `propio:${p.rol_personal}` : p.rol} aria-label={`Rol de ${p.nombre}`} className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm">
                                <OpcionesRol propios={propios} />
                              </select>
                              <BotonEnviar variante="secundario" className="h-9 px-3 text-sm" pendiente="…">
                                Guardar
                              </BotonEnviar>
                            </FormularioAccion>
                          ) : (
                            <Chip tono={p.rol === "superadmin" ? "info" : "neutro"} plano>
                              {p.rol_nombre ?? nombreRol(p.rol)}
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
                          <Chip plano>{i.rol_nombre ?? nombreRol(i.rol)}</Chip>
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
              <FormularioInvitar propios={propios.map((r) => ({ id: r.id, nombre: r.nombre }))} />
            </Tarjeta>
          )}
          <Tarjeta titulo="Políticas de acceso">
            <dl className="flex flex-col text-sm">
              {[
                ["Verificación en dos pasos", "Obligatoria"],
                ...(gestiona ? [] : [["Cerrar sesión por inactividad", `${minutos} min`]]),
                ["Correos de otras personas", "Enmascarados"],
                ["Acciones del equipo", "Quedan en la auditoría"],
              ].map(([k, v]) => (
                <div key={k} className="flex min-h-10 items-center justify-between gap-3 border-b border-divisor last:border-0">
                  <dt className="text-cuerpo">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {gestiona && <FormularioInactividad minutos={minutos} />}
            <IpsPermitidas activo={ips.activo} ips={ips.ips} miIp={miIp} puede={staff.puede("equipo")} />
          </Tarjeta>
          <Tarjeta titulo="Tu verificación y avisos" subtitulo="Llave de seguridad y celular para los avisos del equipo">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-tenue uppercase">Llaves de seguridad</h3>
                <p className="text-[13px] text-tenue">Una llave física (YubiKey) o la huella o el rostro de tu equipo. Con ella entras sin escribir el código.</p>
                <MisLlaves llaves={llaves} />
              </div>
              <div className="flex flex-col gap-2 border-t border-divisor pt-4">
                <h3 className="text-xs font-semibold tracking-wide text-tenue uppercase">Celular</h3>
                <FormularioMiCelular telefono={contacto.data?.telefono ?? null} whatsapp={contacto.data?.whatsapp ?? false} />
              </div>
            </div>
          </Tarjeta>
        </div>
      </div>

      <TarjetaTabla
        titulo="Roles y permisos"
        subtitulo="Nadie del equipo ve los datos financieros de un hogar sin el permiso de su administrador"
        className="mt-5"
        accion={
          gestiona ? (
            <Link href="/consola/equipo?nuevo=rol" scroll={false} className="inline-flex h-9 items-center rounded-lg border border-cuerpo px-3 text-sm font-semibold hover:bg-mosaico">
              Nuevo rol
            </Link>
          ) : undefined
        }
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
                {propios.map((r) => (
                  <th key={r.id} className="text-center!">
                    {gestiona ? (
                      <Link href={`/consola/equipo?nuevo=rol-${r.id}`} scroll={false} className="underline-offset-4 hover:underline" title={r.descripcion || "Editar rol"}>
                        {r.nombre}
                      </Link>
                    ) : (
                      r.nombre
                    )}
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
                  {propios.map((r) => (
                    <td key={r.id} className="text-center">
                      {r.permisos.includes(p.valor) ? <Si /> : <span className="text-tenue">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TarjetaTabla>
      {gestiona && (
        <>
          <Ventana titulo="Nuevo rol" subtitulo="Elige qué puede hacer en la consola" valor="rol" ancho={600}>
            <FormularioRol />
          </Ventana>
          {propios.map((r) => (
            <Ventana key={r.id} titulo={`Rol ${r.nombre}`} subtitulo="Qué puede hacer en la consola" valor={`rol-${r.id}`} ancho={600}>
              <FormularioRol rol={r} />
            </Ventana>
          ))}
        </>
      )}
    </>
  );
}
