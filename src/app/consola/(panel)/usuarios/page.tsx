import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, EnlaceBoton, Titulo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { TarjetaTabla } from "../tarjeta-tabla";
import { cerrarSesiones, restablecerDosPasos } from "./acciones";
import { VerCorreo } from "./ver-correo";

export const metadata: Metadata = { title: "Usuarios" };

const FILTROS = [
  { valor: "todos", texto: "Todos" },
  { valor: "admin", texto: "Administradores" },
  { valor: "editor", texto: "Editores" },
  { valor: "contador", texto: "Contadores" },
  { valor: "sin_2fa", texto: "Sin 2FA" },
  { valor: "equipo", texto: "Equipo My House" },
] as const;
const ROL: Record<string, string> = { admin: "Administrador", editor: "Editor", contador: "Contador" };

type Usuario = {
  user_id: string;
  nombre: string;
  email: string;
  hogar_id: string | null;
  hogar: string | null;
  rol: string | null;
  dos_pasos: boolean;
  ultimo_ingreso: string | null;
  created_at: string;
  es_equipo: boolean;
};

export default async function UsuariosConsola({ searchParams }: PageProps<"/consola/usuarios">) {
  const staff = await obtenerStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const filtro = FILTROS.find((f) => f.valor === sp.filtro)?.valor ?? "todos";
  const antes = typeof sp.antes === "string" && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : undefined;
  const [lista, conteos] = await Promise.all([
    staff.supabase.rpc("consola_usuarios", { p_buscar: q || undefined, p_filtro: filtro, p_antes: antes, p_limite: 25 }),
    staff.supabase.rpc("consola_usuarios_conteos"),
  ]);
  const filas = (lista.data ?? []) as Usuario[];
  const n = (conteos.data ?? {}) as Record<string, number>;
  const gestiona = staff.puede("usuarios");
  const url = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const todo = { q: q || undefined, filtro: filtro === "todos" ? undefined : filtro, ...cambios };
    for (const [k, v] of Object.entries(todo)) if (v) p.set(k, v);
    return `/consola/usuarios${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <Titulo registrar={false} subtitulo="Todas las personas con cuenta en My House">
        Usuarios
      </Titulo>
      {(lista.error || conteos.error) && <Aviso>{mensajeError(lista.error ?? conteos.error)}</Aviso>}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <form action="/consola/usuarios" className="flex min-w-[260px] flex-[1_1_300px] md:max-w-[380px]">
          {filtro !== "todos" && <input type="hidden" name="filtro" value={filtro} />}
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre o correo" aria-label="Buscar por nombre o correo" className="h-10 w-full rounded-lg border border-control bg-elevada px-3 text-[15px]" />
        </form>
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={url({ filtro: f.valor === "todos" ? undefined : f.valor, antes: undefined })}
            aria-current={filtro === f.valor ? "page" : undefined}
            className={cx("inline-flex h-9 items-center rounded-full border px-3 text-sm", filtro === f.valor ? "border-monte bg-monte text-arena" : "border-control bg-elevada")}
          >
            {f.texto} · {(n[f.valor] ?? 0).toLocaleString("es-CO")}
          </Link>
        ))}
      </div>

      <TarjetaTabla
        titulo={FILTROS.find((f) => f.valor === filtro)!.texto}
        subtitulo="Los correos se muestran enmascarados. Verlos completos queda registrado en la auditoría."
        pie={
          (antes || filas.length === 25) && (
            <div className="flex justify-between">
              {antes ? (
                <EnlaceBoton href={url({ antes: undefined })} variante="secundario" className="h-9 text-sm">
                  Primera página
                </EnlaceBoton>
              ) : (
                <span />
              )}
              {filas.length === 25 && (
                <EnlaceBoton href={url({ antes: filas[filas.length - 1].created_at })} variante="secundario" className="h-9 text-sm">
                  Siguiente
                </EnlaceBoton>
              )}
            </div>
          )
        }
      >
        <table className="tabla">
          <thead>
            <tr>
              <th className="pl-4! md:pl-6!">Usuario</th>
              <th>Hogar</th>
              <th>Rol</th>
              <th>2FA</th>
              <th>Último ingreso</th>
              <th className="pr-4! md:pr-6!">{gestiona ? "Acciones" : <span className="sr-only">Acciones</span>}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((u) => (
              <tr key={u.user_id}>
                <td className="pl-4! md:pl-6!">
                  <span className="flex flex-col leading-[18px]">
                    <b>
                      {u.nombre}
                      {u.es_equipo && <span className="ml-1.5 text-xs font-semibold text-teja">Equipo</span>}
                    </b>
                    <VerCorreo usuario={u.user_id} enmascarado={u.email} />
                  </span>
                </td>
                <td className="text-cuerpo">
                  {u.hogar_id ? (
                    <Link href={`/consola/hogares/${u.hogar_id}`} className="underline-offset-4 hover:underline">
                      {u.hogar}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{u.rol ? <Chip plano>{ROL[u.rol] ?? u.rol}</Chip> : "—"}</td>
                <td>{u.dos_pasos ? <Chip tono="ok">Activa</Chip> : <Chip tono="alerta">Sin activar</Chip>}</td>
                <td className="text-cuerpo">{formatearMomento(u.ultimo_ingreso)}</td>
                <td className="pr-4! md:pr-6!">
                  {gestiona && u.user_id !== staff.userId ? (
                    <span className="inline-flex flex-wrap gap-1">
                      <FormularioAccion accion={cerrarSesiones} className="inline-flex">
                        <input type="hidden" name="usuario" value={u.user_id} />
                        <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                          Cerrar sesiones
                        </BotonEnviar>
                      </FormularioAccion>
                      {u.dos_pasos && (
                        <FormularioAccion accion={restablecerDosPasos} className="inline-flex">
                          <input type="hidden" name="usuario" value={u.user_id} />
                          <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                            Restablecer 2FA
                          </BotonEnviar>
                        </FormularioAccion>
                      )}
                    </span>
                  ) : (
                    <span className="text-tenue">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TarjetaTabla>
    </>
  );
}
