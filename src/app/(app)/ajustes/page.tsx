import Link from "next/link";
import { AccionPrincipal, Boton, Chip, CuadroIcono, EnlaceBoton, Tarjeta, Titulo, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { Ventana } from "@/components/ui/ventana";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Palanca } from "@/components/ui/interruptor";
import { BotonGuia } from "@/components/guia/boton-guia";
import { obtenerContexto } from "@/lib/sesion";
import { leerConfigHogar } from "@/lib/hogar";
import { nombreRol, ROLES_HOGAR } from "@/lib/hogar/constantes";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { formatearTrm } from "@/lib/trm";
import { formatearMomento } from "@/lib/consola/formato";
import { fechaVersion, VERSION_LEGAL } from "@/lib/legal/responsable";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { cambiarNovedades, cambiarResumenSemanal } from "../recordatorios/acciones";
import { cerrarOtrasSesiones } from "./acciones";
import { FormularioDatosHogar, FormularioPrivacidad, FormularioTrm } from "./configuracion";
import { CopiarEnlace } from "./miembros/formularios";
import { Contrasena, EstadoDosPasos } from "./seguridad/componentes";

export const metadata = { title: "Configuración" };

/** Secciones de la página (diseño «Configuración»: una sola página con fichas que llevan a cada parte). */
const SECCIONES = [
  { id: "hogar", texto: "Hogar y miembros" },
  { id: "cuentas", texto: "Cuentas" },
  { id: "categorias", texto: "Categorías" },
  { id: "valores", texto: "UVT y TRM" },
  { id: "seguridad", texto: "Seguridad" },
  { id: "privacidad", texto: "Privacidad y datos" },
  { id: "plan", texto: "Plan" },
] as const;

const TIPO_CUENTA: Record<string, { texto: string; icono: NombreIcono }> = {
  banco: { texto: "Banco", icono: "cuentas" },
  ahorros: { texto: "Ahorros", icono: "cuentas" },
  corriente: { texto: "Corriente", icono: "cuentas" },
  tarjeta: { texto: "Crédito", icono: "cuentas" },
  billetera: { texto: "Billetera", icono: "conectividad" },
  efectivo: { texto: "Efectivo", icono: "ingresos" },
};

const DOCUMENTO: Record<string, string> = { terminos: "Términos y condiciones", politica_datos: "Política de tratamiento de datos", comunicaciones: "Consejos, novedades y ofertas" };

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** Interruptor que se envía solo (preferencias de correo del hogar). */
function Preferencia({ accion, activo, titulo, texto, puede }: { accion: Parameters<typeof FormularioAccion>[0]["accion"]; activo: boolean; titulo: string; texto: string; puede: boolean }) {
  return (
    <FormularioAccion accion={accion} className="flex min-h-14 items-center justify-between gap-3 border-b border-divisor py-2 last:border-0">
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      <span className="text-sm">
        <b className="block">{titulo}</b>
        <span className="text-[13px] text-tenue">{texto}</span>
      </span>
      <button type="submit" role="switch" aria-checked={activo} aria-label={titulo} disabled={!puede} className="rounded-full disabled:opacity-50">
        <Palanca activo={activo} />
      </button>
    </FormularioAccion>
  );
}

export default async function Configuracion() {
  const ctx = await obtenerContexto();
  const anio = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const [{ data: auth }, { data: hogar }, { data: miembros }, { data: invitaciones }, { data: cuentas }, { data: categorias }, { data: uvts }, { data: trm }, { data: consentimientos }, { data: plan }] =
    await Promise.all([
      // El último ingreso solo lo sabe Auth (una consulta; el JWT no lo trae).
      ctx.supabase.auth.getUser(),
      ctx.supabase.from("households").select("nombre, ciudad, moneda, config, plan").eq("id", ctx.hogar.id).single(),
      ctx.supabase.from("members").select("id, nombre, rol, user_id").eq("es_dependiente", false).not("user_id", "is", null).order("created_at"),
      ctx.esAdmin ? ctx.supabase.from("invitations").select("id, email, telefono, rol, token, created_at").is("aceptada_en", null).gt("expira_en", new Date().toISOString()).order("created_at") : Promise.resolve({ data: [] }),
      ctx.supabase.from("accounts").select("id, nombre, tipo, subtipo, entidad, ultimos4, dia_corte, dia_pago, titular_member_id").eq("archivada", false).order("created_at"),
      ctx.supabase.from("categories").select("id, nombre, clase").is("padre_id", null).eq("archivada", false).order("clase").order("nombre"),
      ctx.supabase.from("tax_params").select("anio, uvt_valor").eq("pais", ctx.hogar.pais).in("anio", [anio, anio + 1]).eq("publicado", true),
      ctx.supabase.from("trm").select("fecha, valor, creada").order("fecha", { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from("consentimientos").select("tipo, version, aceptado, created_at").order("created_at", { ascending: false }),
      ctx.supabase.rpc("mi_plan", { p_hogar: ctx.hogar.id }),
    ]);
  const config = leerConfigHogar(hogar?.config);
  const user = { email: auth.user?.email ?? ctx.email, last_sign_in_at: auth.user?.last_sign_in_at ?? null };
  const nombrePorId = new Map((miembros ?? []).map((m) => [m.id, m.nombre.split(/\s+/)[0]]));
  const uvt = (a: number) => uvts?.find((u) => u.anio === a)?.uvt_valor;
  const gasto = (categorias ?? []).filter((c) => c.clase === "gasto");
  const ingreso = (categorias ?? []).filter((c) => c.clase === "ingreso");
  // El documento vigente que aceptó (el más reciente de cada tipo).
  const aceptados = (["terminos", "politica_datos"] as const).map((t) => ({ tipo: t, fila: consentimientos?.find((c) => c.tipo === t && c.aceptado) }));
  const planActual = (plan as { efectivo?: string } | null)?.efectivo ?? hogar?.plan ?? "gratis";

  return (
    <>
      <Titulo
        subtitulo="El hogar, quién entra, con qué cuentas y con qué valores"
        accion={
          <>
            <BotonGuia id="invitar" />
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

      <nav aria-label="Secciones" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:mb-5 md:flex-wrap md:px-0">
        {SECCIONES.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cx("inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap", i === 0 ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico")}
          >
            {s.texto}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-4 md:gap-5">
        <section id="hogar" aria-label="Hogar y miembros" className="scroll-mt-4">
          <Tarjeta titulo="Hogar y miembros" subtitulo="Todos ven el mismo hogar; cada rol decide qué puede cambiar" accion={<EnlaceBoton href="/ajustes/hogar" variante="fantasma" className="h-9 text-sm">Más del hogar</EnlaceBoton>}>
            <div className="flex flex-col gap-4">
              <FormularioDatosHogar nombre={hogar?.nombre ?? ctx.hogar.nombre} ciudad={hogar?.ciudad ?? null} moneda={hogar?.moneda ?? "COP"} puede={ctx.esAdmin} />
              <ul className="flex flex-col">
                {(miembros ?? []).map((m, i) => {
                  const rol = m.rol ? ROLES_HOGAR[m.rol] : null;
                  return (
                    <li key={m.id} className="flex min-h-[68px] flex-wrap items-center gap-3.5 border-b border-divisor py-2.5">
                      <span className={cx("inline-flex size-10 shrink-0 items-center justify-center rounded-full font-bold", i === 0 ? "bg-monte text-arena" : "bg-teja text-white")}>{iniciales(m.nombre)}</span>
                      <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                        <b className="text-[15px]">
                          {m.nombre}
                          {m.user_id === ctx.userId && <span className="font-normal text-tenue"> (tú)</span>}
                        </b>
                        {m.user_id === ctx.userId && <span className="truncate text-[13px] text-tenue">{user.email}</span>}
                      </span>
                      {rol && <Chip tono={rol.tono}>{rol.nombre}</Chip>}
                      <span className="hidden w-[220px] text-[13px] text-tenue md:inline">{rol?.puede}</span>
                      {ctx.esAdmin && m.user_id !== ctx.userId && (
                        <EnlaceBoton href="/ajustes/miembros" variante="fantasma" className="h-9 text-sm">
                          Editar
                        </EnlaceBoton>
                      )}
                    </li>
                  );
                })}
                {(invitaciones ?? []).map((v) => (
                  <li key={v.id} className="flex min-h-[68px] flex-wrap items-center gap-3.5 border-b border-divisor py-2.5">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mosaico font-bold text-tinta">{(v.email ?? "?")[0]?.toUpperCase()}</span>
                    <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                      <b className="truncate text-[15px]">{v.email ?? v.telefono}</b>
                      <span className="text-[13px] text-tenue">Invitación enviada el {formatearFecha(v.created_at.slice(0, 10))}</span>
                    </span>
                    <Chip tono="alerta">{nombreRol(v.rol)}</Chip>
                    <span className="w-full md:w-[320px]">
                      <CopiarEnlace enlace={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/invitacion/${v.token}`} />
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/ajustes/miembros" className="self-start text-sm font-semibold underline-offset-4 hover:underline">
                Personas a cargo y roles ›
              </Link>
            </div>
          </Tarjeta>
        </section>

        <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
          <section id="cuentas" aria-label="Cuentas" className="scroll-mt-4">
            <Tarjeta titulo="Cuentas" subtitulo="De dónde sale y a dónde entra la plata" accion={<EnlaceBoton href="/cuentas" variante="secundario" className="h-9 text-sm">Gestionar cuentas y tarjetas</EnlaceBoton>}>
              <ul className="flex flex-col">
                {(cuentas ?? []).map((c) => {
                  const t = TIPO_CUENTA[c.tipo === "banco" ? (c.subtipo ?? "banco") : c.tipo];
                  const detalle = [
                    c.ultimos4 ? (c.tipo === "billetera" ? `··· ${c.ultimos4}` : `Terminada en ${c.ultimos4}`) : null,
                    c.tipo === "tarjeta" && c.dia_corte ? `corte el ${c.dia_corte}` : null,
                    c.tipo === "tarjeta" && c.dia_pago ? `pago el ${c.dia_pago}` : null,
                    c.titular_member_id ? nombrePorId.get(c.titular_member_id) : "Compartida",
                  ].filter(Boolean);
                  return (
                    <li key={c.id} className="flex min-h-14 items-center gap-3 border-b border-divisor py-2 last:border-0">
                      <CuadroIcono nombre={t?.icono ?? "cuentas"} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="truncate text-[15px]">{c.nombre}</b>
                        <span className="truncate text-[13px] text-tenue">{detalle.join(" · ")}</span>
                      </span>
                      <span className="text-sm font-semibold text-cuerpo">{t?.texto}</span>
                    </li>
                  );
                })}
                {!cuentas?.length && <li className="py-3 text-sm text-tenue">Aún no hay cuentas.</li>}
              </ul>
            </Tarjeta>
          </section>

          <section id="categorias" aria-label="Categorías" className="scroll-mt-4">
            <Tarjeta
              titulo="Categorías"
              subtitulo={`${gasto.length} de gasto · ${ingreso.length} de ingreso`}
              accion={ctx.puedeEditar ? <EnlaceBoton href="/categorias" variante="secundario" className="h-9 text-sm">Agregar categoría</EnlaceBoton> : undefined}
            >
              <div className="flex flex-wrap gap-2">
                {[...gasto, ...ingreso].map((c) => (
                  <Link key={c.id} href="/categorias" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-borde pr-3 pl-1.5 text-sm font-semibold hover:bg-mosaico">
                    <span className="inline-flex size-7 items-center justify-center rounded-lg bg-mosaico">
                      <Icono nombre={iconoCategoria(c.nombre, c.clase)} tamano={18} />
                    </span>
                    {c.nombre}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-tenue">Cada categoría puede llevar una etiqueta DIAN por defecto; por ejemplo, Salud → Medicina prepagada.</p>
            </Tarjeta>
          </section>
        </div>

        <section id="valores" aria-label="UVT y TRM" className="scroll-mt-4">
          <Tarjeta titulo="UVT y TRM" subtitulo="Los valores con que My House calcula topes y convierte pagos en dólares">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Dato etiqueta={`UVT ${anio}`} valor={uvt(anio) ? formatearCOP(uvt(anio)!) : "Sin publicar"} />
              <Dato etiqueta={`UVT ${anio + 1}`} valor={uvt(anio + 1) ? formatearCOP(uvt(anio + 1)!) : "Pendiente de publicación"} tenue={!uvt(anio + 1)} />
              <Dato
                etiqueta={config.trm.auto ? "TRM de hoy" : "TRM que usas"}
                valor={config.trm.auto ? (trm ? formatearTrm(Number(trm.valor)) : "Sin datos aún") : config.trm.manual ? formatearTrm(config.trm.manual) : "—"}
                detalle={config.trm.auto && trm ? `Vigente el ${formatearFecha(trm.fecha)} · actualizada ${formatearMomento(trm.creada)}` : config.trm.auto ? "Se actualiza cada mañana" : "Fija, la escribiste tú"}
              />
              <div>
                <FormularioTrm auto={config.trm.auto} manual={config.trm.manual} puede={ctx.esAdmin} />
              </div>
            </div>
            <p className="mt-4 text-[13px] text-tenue">
              La UVT la publica la DIAN cada año; los topes de Renta se calculan con ella. La TRM convierte los pagos que registras en dólares («¿Pagaste en dólares?» en Registrar).
            </p>
          </Tarjeta>
        </section>

        <section id="seguridad" aria-label="Seguridad" className="scroll-mt-4">
          <Tarjeta titulo="Seguridad" subtitulo="Cómo entras a My House y desde dónde" accion={<BotonGuia id="dos_pasos">Cómo activar dos pasos</BotonGuia>}>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-tenue uppercase">Contraseña</h3>
                <Contrasena />
              </div>
              <div className="flex flex-col gap-2" data-guia="dos-pasos">
                <h3 className="text-xs font-semibold tracking-wide text-tenue uppercase">Verificación en dos pasos</h3>
                <EstadoDosPasos />
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold tracking-wide text-tenue uppercase">Sesiones</h3>
                <p className="text-sm text-cuerpo">
                  Tu cuenta: <b>{user.email}</b>
                  {user.last_sign_in_at && (
                    <>
                      <br />
                      Último ingreso: {formatearMomento(user.last_sign_in_at)}
                    </>
                  )}
                </p>
                <p className="text-[13px] text-tenue">Si entras desde un navegador nuevo te avisamos por correo («¿Fuiste tú?»).</p>
                <FormularioAccion accion={cerrarOtrasSesiones} className="flex flex-col gap-2">
                  <BotonEnviar variante="secundario" pendiente="Cerrando…">
                    Cerrar sesión en los otros dispositivos
                  </BotonEnviar>
                </FormularioAccion>
                <form action={cerrarSesion}>
                  <Boton type="submit" variante="fantasma" className="w-full">
                    Cerrar sesión aquí
                  </Boton>
                </form>
              </div>
            </div>
          </Tarjeta>
        </section>

        <section id="privacidad" aria-label="Privacidad y datos" className="scroll-mt-4">
          <Tarjeta titulo="Privacidad y datos" subtitulo="Lo que aceptaste, lo que recibes y lo que puedes pedir sobre tus datos (Ley 1581 de 2012)">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold tracking-wide text-tenue uppercase">Documentos que aceptaste</p>
                {aceptados.map(({ tipo, fila }) => (
                  <Link key={tipo} href={tipo === "terminos" ? "/terminos" : "/privacidad"} className="flex items-center justify-between gap-3 rounded-xl border border-borde px-3.5 py-3 hover:bg-mosaico">
                    <span>
                      <b className="text-sm">{DOCUMENTO[tipo]}</b>
                      <br />
                      <span className="text-[13px] text-tenue">
                        Versión {fechaVersion(fila?.version ?? VERSION_LEGAL)}
                        {fila ? ` · aceptada el ${formatearFecha(fila.created_at.slice(0, 10))}` : " · aceptada al crear tu cuenta"}
                      </span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col">
                <p className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Qué te enviamos</p>
                <div className="flex min-h-14 items-center justify-between gap-3 border-b border-divisor py-2">
                  <span className="text-sm">
                    <b className="block">Avisos de pagos y seguridad</b>
                    <span className="text-[13px] text-tenue">Necesarios para que la app funcione</span>
                  </span>
                  <Chip plano>Siempre</Chip>
                </div>
                <Preferencia accion={cambiarNovedades} activo={config.correo.novedades} titulo="Consejos, novedades y ofertas" texto="Por correo" puede={ctx.esAdmin} />
                <Preferencia accion={cambiarResumenSemanal} activo={config.correo.resumen_semanal} titulo="Resumen semanal" texto="Lunes, 7:00 a. m." puede={ctx.esAdmin} />
                {!ctx.esAdmin && <p className="pt-2 text-[13px] text-tenue">Estas preferencias las cambia quien administra el hogar.</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5 border-t border-divisor pt-4">
              <a href="/api/mis-datos" download className="inline-flex h-11 items-center rounded-[10px] border border-cuerpo px-4 text-[15px] font-semibold hover:bg-mosaico">
                Descargar mis datos
              </a>
              <EnlaceBoton href="/ajustes?nuevo=consulta#privacidad" variante="secundario" scroll={false}>
                Hacer una consulta o reclamo
              </EnlaceBoton>
              <EnlaceBoton href="/ajustes?nuevo=revocar" variante="fantasma" scroll={false}>
                Revocar la autorización
              </EnlaceBoton>
              <EnlaceBoton href="/ajustes?nuevo=eliminar" variante="fantasma" scroll={false} className="text-error-tinta md:ml-auto">
                Eliminar mi cuenta
              </EnlaceBoton>
            </div>
            <p className="mt-3 text-[13px] text-tenue">
              Respondemos consultas en máximo 10 días hábiles y reclamos en 15. Si revocas la autorización, no podremos seguir guardando los datos del hogar y tu cuenta se cerrará. Sigue tus
              solicitudes en{" "}
              <Link href="/ayuda" className="font-semibold text-tinta underline">
                Ayuda
              </Link>
              .
            </p>
          </Tarjeta>
        </section>

        <section id="plan" aria-label="Plan" className="scroll-mt-4">
          <Tarjeta titulo="Plan" subtitulo="Lo que incluye, cuánto usas y tus pagos" accion={<EnlaceBoton href="/ajustes/plan" variante="secundario" className="h-9 text-sm">Ver plan y pagos</EnlaceBoton>}>
            <p className="text-sm text-cuerpo">
              Tu hogar está en el plan <b className="capitalize">{planActual}</b>. Pagas aquí mismo con tarjeta o Nequi, y puedes dejar la renovación automática.
            </p>
          </Tarjeta>
        </section>
      </div>

      <Ventana titulo="Consulta o reclamo sobre tus datos" subtitulo="Ley 1581 de 2012" valor="consulta">
        <FormularioPrivacidad tipo="consulta" />
      </Ventana>
      <Ventana titulo="Revocar la autorización" subtitulo="Dejar de autorizar el tratamiento de tus datos" valor="revocar">
        <FormularioPrivacidad tipo="revocatoria" />
      </Ventana>
      <Ventana titulo="Eliminar mi cuenta" subtitulo="Esto no se puede deshacer" valor="eliminar">
        <FormularioPrivacidad tipo="supresion" />
      </Ventana>
    </>
  );
}

function Dato({ etiqueta, valor, detalle, tenue }: { etiqueta: string; valor: string; detalle?: string; tenue?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-cuerpo">{etiqueta}</span>
      <span className={cx("flex h-11 items-center rounded-[10px] border border-control bg-mosaico/50 px-3 text-[15px]", tenue ? "text-tenue" : "font-semibold")}>{valor}</span>
      {detalle && <span className="text-[13px] text-tenue">{detalle}</span>}
    </div>
  );
}
