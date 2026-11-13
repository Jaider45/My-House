import type { Metadata } from "next";
import Link from "next/link";
import { resolveTxt } from "node:dns/promises";
import { Aviso, Chip, Titulo, claseControl, cx, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { Conmutador } from "@/components/ui/interruptor";
import { obtenerStaff } from "@/lib/consola/sesion";
import { leerIntegracion } from "@/lib/integraciones/servidor";
import type { AvisoEquipo, Envios, Factura, LimitesApp } from "@/lib/plataforma/config";
import type { Empresa } from "@/lib/legal/empresa";
import { guardarAjuste } from "./acciones";

export const metadata: Metadata = { title: "Ajustes de la plataforma" };

const PESTANAS = [
  ["empresa", "Empresa"],
  ["envios", "Envíos"],
  ["pagos", "Pagos y facturación"],
  ["avisos", "Avisos y límites"],
] as const;
type Pestana = (typeof PESTANAS)[number][0];

const EVENTOS: { clave: string; texto: string }[] = [
  { clave: "pago_fallido", texto: "Pago fallido de un hogar" },
  { clave: "ticket_urgente", texto: "Ticket urgente o de prioridad alta sin respuesta en 1 hora" },
  { clave: "solicitud_1581", texto: "Solicitud de un titular (Ley 1581)" },
  { clave: "servicio_caido", texto: "Un servicio deja de responder" },
  { clave: "plantilla_rechazada", texto: "Meta rechaza una plantilla de WhatsApp" },
];
const ROLES = [
  ["superadmin", "Superadmin"],
  ["soporte", "Soporte"],
  ["finanzas", "Finanzas"],
  ["contenido", "Contenido"],
] as const;

/** Fila «etiqueta ··· control» del diseño (bloque «planed»). */
function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-divisor py-2 text-sm last:border-0">
      <span className="text-cuerpo">{etiqueta}</span>
      {children}
    </div>
  );
}

function Entrada({ name, valor, ancho = "md:w-[260px]", ...props }: React.ComponentProps<"input"> & { valor?: string | number | null; ancho?: string }) {
  return <input name={name} defaultValue={valor ?? ""} aria-label={name} className={cx(claseControl, "h-9 w-full text-right md:text-right", ancho)} {...props} />;
}

function Panel({ titulo, subtitulo, clave, children, puede }: { titulo: string; subtitulo?: string; clave?: string; children: React.ReactNode; puede: boolean }) {
  const cuerpo = (
    <>
      <div className="mb-2">
        <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-sm text-tenue">{subtitulo}</p>}
      </div>
      {children}
    </>
  );
  return (
    <section className="rounded-2xl border border-borde bg-elevada p-4 md:p-6">
      {clave ? (
        <FormularioEstado accion={guardarAjuste} className="flex flex-col">
          <input type="hidden" name="clave" value={clave} />
          {cuerpo}
          {puede && (
            <BotonEnviar className="mt-3 self-start" variante="secundario">
              Guardar
            </BotonEnviar>
          )}
        </FormularioEstado>
      ) : (
        cuerpo
      )}
    </section>
  );
}

/** Registros del dominio de envío: SPF y DKIM según Resend (llave con acceso completo); DMARC por DNS. */
async function estadoDominio(apiKey: string | undefined, remitente: string) {
  const dominio = remitente.match(/@([^>\s]+)>?$/)?.[1]?.toLowerCase() ?? null;
  if (!dominio) return null;
  let spf: Tono = "neutro";
  let dkim: Tono = "neutro";
  let nota: string | null = null;
  if (apiKey) {
    try {
      const r = await fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (r.status === 401 || r.status === 403) nota = "La llave de Resend es de solo envío: revisa SPF y DKIM en el panel de Resend.";
      else if (r.ok) {
        const lista = ((await r.json()) as { data?: { id: string; name: string }[] }).data ?? [];
        const d = lista.find((x) => dominio === x.name || dominio.endsWith(`.${x.name}`));
        if (!d) nota = `El dominio ${dominio} no está agregado en Resend.`;
        else {
          const det = (await (await fetch(`https://api.resend.com/domains/${d.id}`, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000), cache: "no-store" })).json()) as {
            records?: { record: string; status: string }[];
          };
          const estado = (tipo: string): Tono => {
            const rs = (det.records ?? []).filter((x) => x.record === tipo);
            return !rs.length ? "neutro" : rs.every((x) => x.status === "verified") ? "ok" : "alerta";
          };
          spf = estado("SPF");
          dkim = estado("DKIM");
        }
      }
    } catch {
      nota = "No pudimos consultar Resend ahora.";
    }
  }
  let dmarc: Tono = "alerta";
  let politica = "sin registro";
  try {
    const txt = (await resolveTxt(`_dmarc.${dominio}`)).map((p) => p.join("")).find((t) => t.startsWith("v=DMARC1"));
    if (txt) {
      politica = txt.match(/p=(\w+)/)?.[1] ?? "?";
      dmarc = politica === "none" ? "alerta" : "ok";
    }
  } catch {
    /* sin registro */
  }
  return { dominio, spf, dkim, dmarc, politica, nota };
}

const chipRegistro = (t: Tono, ok = "Verificado") => <Chip tono={t}>{t === "ok" ? ok : t === "alerta" ? "Revisar" : "Sin datos"}</Chip>;

export default async function AjustesPlataforma({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await obtenerStaff();
  const pedida = (await searchParams).tab;
  const tab = (PESTANAS.find(([k]) => k === pedida)?.[0] ?? "empresa") as Pestana;
  const puede = staff.puede("sistema");
  const [{ data: filas }, { data: integraciones }, { data: familia }] = await Promise.all([
    staff.supabase.from("plataforma_config").select("clave, valor"),
    puede ? staff.supabase.rpc("consola_integraciones") : Promise.resolve({ data: null }),
    staff.supabase.from("planes").select("limites").eq("codigo", "familia").maybeSingle(),
  ]);
  const cfg = Object.fromEntries((filas ?? []).map((f) => [f.clave, f.valor])) as Record<string, unknown>;
  const empresa = (cfg.empresa ?? {}) as Empresa;
  const env = (cfg.envios ?? {}) as Envios;
  const factura = (cfg.factura ?? {}) as Factura;
  const avisos = (cfg.avisos_equipo ?? {}) as Record<string, AvisoEquipo>;
  const limites = (cfg.limites_app ?? {}) as LimitesApp;
  const reintentos = (cfg.cobro_reintentos ?? [1, 3, 7]) as number[];
  const integ = new Map((integraciones ?? []).map((i) => [i.proveedor, i]));
  const estadoInteg = (p: string) => {
    const i = integ.get(p);
    if (!i?.activa) return <Chip tono="neutro">Sin conectar</Chip>;
    const v = i.verificacion as { ok?: boolean; detalle?: string } | null;
    return <Chip tono={v?.ok === false ? "error" : "ok"}>{v?.ok === false ? "Fallando" : "Conectada"}</Chip>;
  };
  const resend = tab === "envios" && puede ? await leerIntegracion("resend") : null;
  const remitente = env.remitente || resend?.valores.remitente || process.env.CORREO_REMITENTE || "";
  const dominio = tab === "envios" ? await estadoDominio(resend?.valores.api_key, remitente) : null;
  const wa = integ.get("whatsapp");
  const waDetalle = (wa?.verificacion as { detalle?: string } | null)?.detalle ?? "";

  return (
    <>
      <Titulo registrar={false} subtitulo="Datos de la empresa, envíos, pagos, facturación y avisos para el equipo">
        Ajustes de la plataforma
      </Titulo>
      {!puede && <Aviso tipo="info">Solo un superadmin cambia estos ajustes. Puedes verlos.</Aviso>}
      <nav role="tablist" aria-label="Secciones" className="mb-4 flex gap-1 overflow-x-auto border-b border-divisor">
        {PESTANAS.map(([k, t]) => (
          <Link
            key={k}
            role="tab"
            aria-selected={tab === k}
            href={`/consola/ajustes?tab=${k}`}
            className={cx("h-10 shrink-0 border-b-2 px-3 pt-2 text-sm font-semibold", tab === k ? "border-monte text-tinta" : "border-transparent text-cuerpo hover:text-tinta")}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "empresa" && (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Panel titulo="Empresa" subtitulo="Salen en los documentos legales, los correos y la factura" clave="empresa" puede={puede}>
            <Fila etiqueta="Razón social">
              <Entrada name="razon_social" valor={empresa.razon_social} placeholder="[razón social]" />
            </Fila>
            <Fila etiqueta="NIT">
              <Entrada name="nit" valor={empresa.nit} placeholder="901.234.567-8" />
            </Fila>
            <Fila etiqueta="Correo de contacto">
              <Entrada name="correo_contacto" type="email" valor={empresa.correo_contacto} placeholder="hola@dominio.co" />
            </Fila>
            <Fila etiqueta="Responsable de datos personales">
              <Entrada name="responsable" valor={empresa.responsable} placeholder="[nombre del responsable]" />
            </Fila>
            <Fila etiqueta="Correo para datos personales (Ley 1581)">
              <Entrada name="correo_datos" type="email" valor={empresa.correo_datos} />
            </Fila>
            <Fila etiqueta="Correo de soporte">
              <Entrada name="correo_soporte" type="email" valor={empresa.correo_soporte} />
            </Fila>
            <Fila etiqueta="Dirección">
              <Entrada name="direccion" valor={empresa.direccion} placeholder="Calle 00 # 00-00" />
            </Fila>
            <Fila etiqueta="Ciudad">
              <Entrada name="ciudad" valor={empresa.ciudad} />
            </Fila>
            <Fila etiqueta="Teléfono">
              <Entrada name="telefono" valor={empresa.telefono} />
            </Fila>
          </Panel>
          <Panel titulo="Región y formato" subtitulo="Fijos en esta versión" puede={false}>
            <Fila etiqueta="País principal">
              <b>Colombia</b>
            </Fila>
            <Fila etiqueta="Moneda">
              <b>Peso colombiano (COP)</b>
            </Fila>
            <Fila etiqueta="Zona horaria">
              <b>América/Bogotá</b>
            </Fila>
            <Fila etiqueta="Formato de cifras">
              <b>$ 1.234.567</b>
            </Fila>
            <Fila etiqueta="Idioma">
              <b>Español (Colombia)</b>
            </Fila>
          </Panel>
        </div>
      )}

      {tab === "envios" && (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Panel titulo="Correo" clave="envios" puede={puede}>
            <input type="hidden" name="wa_desde" value={env.wa_desde} />
            <input type="hidden" name="wa_hasta" value={env.wa_hasta} />
            <input type="hidden" name="wa_sin_marketing_domingo" value={env.wa_sin_marketing_domingo ? "1" : "0"} />
            <Fila etiqueta="Dominio de envío">
              <b>{dominio?.dominio ?? "—"}</b>
            </Fila>
            <Fila etiqueta="SPF">{chipRegistro(dominio?.spf ?? "neutro")}</Fila>
            <Fila etiqueta="DKIM">{chipRegistro(dominio?.dkim ?? "neutro")}</Fila>
            <Fila etiqueta={`DMARC · ${dominio?.politica ?? "—"}`}>{chipRegistro(dominio?.dmarc ?? "neutro", "Política activa")}</Fila>
            {dominio?.nota && <p className="py-2 text-[13px] text-tenue">{dominio.nota}</p>}
            <Fila etiqueta="Remitente">
              <Entrada name="remitente" valor={env.remitente} placeholder={resend?.valores.remitente || "My House <hola@dominio.co>"} />
            </Fila>
            <Fila etiqueta="Responder a">
              <Entrada name="responder_a" type="email" valor={env.responder_a} placeholder="soporte@dominio.co" />
            </Fila>
          </Panel>
          <Panel titulo="WhatsApp Business" clave="envios" puede={puede}>
            <input type="hidden" name="remitente" value={env.remitente} />
            <input type="hidden" name="responder_a" value={env.responder_a} />
            <Fila etiqueta="Número y calidad">
              <b className="text-right">{waDetalle || "—"}</b>
            </Fila>
            <Fila etiqueta="Estado">{estadoInteg("whatsapp")}</Fila>
            <Fila etiqueta="Horario de envío de avisos">
              <span className="flex items-center gap-2">
                <Entrada name="wa_desde" type="time" valor={env.wa_desde} ancho="w-[120px]" />
                <span>a</span>
                <Entrada name="wa_hasta" type="time" valor={env.wa_hasta} ancho="w-[120px]" />
              </span>
            </Fila>
            <Fila etiqueta="No enviar marketing los domingos">
              <Conmutador name="wa_sin_marketing_domingo" defaultChecked={env.wa_sin_marketing_domingo} etiqueta="No enviar marketing los domingos" />
            </Fila>
            <p className="pt-2 text-[13px] text-tenue">
              Se conecta en <Link href="/consola/integraciones" className="font-semibold underline">Integraciones</Link>. Las plantillas se crean en{" "}
              <Link href="/consola/whatsapp" className="font-semibold underline">Plantillas de WhatsApp</Link>.
            </p>
          </Panel>
        </div>
      )}

      {tab === "pagos" && (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Panel titulo="Pasarelas de pago" puede={false}>
              <Fila etiqueta="Wompi · Colombia (tarjeta, Nequi)">{estadoInteg("wompi")}</Fila>
              <Fila etiqueta="Tarjetas internacionales">
                <Chip tono="neutro">Aún no disponible</Chip>
              </Fila>
              <p className="pt-2 text-[13px] text-tenue">
                Las llaves se conectan en <Link href="/consola/integraciones" className="font-semibold underline">Integraciones</Link>.
              </p>
            </Panel>
            <Panel titulo="Reintentos de cobro" subtitulo="Días de mora en que se reintenta la tarjeta guardada y se avisa" clave="cobro_reintentos" puede={puede}>
              <Fila etiqueta="Días (además del día del vencimiento)">
                <Entrada name="dias" valor={reintentos.join(", ")} ancho="md:w-[160px]" />
              </Fila>
            </Panel>
            <Panel titulo="Paso a Gratis" clave="cobro_dia_gratis" puede={puede}>
              <Fila etiqueta="Día de mora en que el hogar pasa a Gratis">
                <Entrada name="valor" type="number" min={7} max={60} valor={String(cfg.cobro_dia_gratis ?? 14)} ancho="md:w-[120px]" />
              </Fila>
            </Panel>
            <Panel titulo="Prueba gratis de Familia" clave="prueba_dias" puede={staff.puede("planes")}>
              <Fila etiqueta="Días de prueba (0 = sin prueba)">
                <Entrada name="valor" type="number" min={0} max={60} valor={String(cfg.prueba_dias ?? 14)} ancho="md:w-[120px]" />
              </Fila>
            </Panel>
          </div>
          <Panel titulo="Factura electrónica" subtitulo="Mientras no haya proveedor, los cobros quedan con la factura pendiente" clave="factura" puede={puede}>
            <Fila etiqueta="Proveedor tecnológico">
              <Entrada name="proveedor" valor={factura.proveedor} placeholder="[proveedor autorizado]" />
            </Fila>
            <Fila etiqueta="Resolución de facturación DIAN">
              <Entrada name="resolucion" valor={factura.resolucion} placeholder="[número de resolución]" />
            </Fila>
            <Fila etiqueta="Prefijo">
              <Entrada name="prefijo" valor={factura.prefijo} placeholder="FE-MH" ancho="md:w-[140px]" />
            </Fila>
            <Fila etiqueta="Rango autorizado">
              <span className="flex items-center gap-2">
                <Entrada name="desde" inputMode="numeric" valor={factura.desde ?? ""} ancho="w-[110px]" placeholder="1" />
                <span>a</span>
                <Entrada name="hasta" inputMode="numeric" valor={factura.hasta ?? ""} ancho="w-[110px]" placeholder="50000" />
              </span>
            </Fila>
            <Fila etiqueta="Enviar la factura por correo">
              <Conmutador name="enviar_correo" defaultChecked={factura.enviar_correo} etiqueta="Enviar la factura por correo" />
            </Fila>
          </Panel>
        </div>
      )}

      {tab === "avisos" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel titulo="Avisos para el equipo" subtitulo="Quién se entera de qué · por correo (el superadmin recibe todos los activos)" clave="avisos_equipo" puede={puede}>
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cuando pase esto</th>
                    <th>Avisar a</th>
                    <th>Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTOS.map((e) => {
                    const a = avisos[e.clave] ?? { roles: [], activo: false };
                    return (
                      <tr key={e.clave}>
                        <td className="font-semibold whitespace-normal!">{e.texto}</td>
                        <td>
                          <span className="flex flex-wrap gap-x-3 gap-y-1">
                            {ROLES.map(([r, t]) => (
                              <label key={r} className="inline-flex items-center gap-1.5 text-[13px]">
                                <input type="checkbox" name={`${e.clave}_${r}`} defaultChecked={a.roles.includes(r)} className="size-4 accent-monte" />
                                {t}
                              </label>
                            ))}
                          </span>
                        </td>
                        <td>
                          <Conmutador name={`${e.clave}_activo`} defaultChecked={a.activo} etiqueta={`Aviso activo: ${e.texto}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel titulo="Límites y seguridad de la app" clave="limites_app" puede={puede}>
            <Fila etiqueta="Personas por hogar · Familia">
              <Link href="/consola/planes" className="font-semibold underline-offset-4 hover:underline">
                {(familia?.limites as { personas?: number | null } | null)?.personas ?? "Sin límite"} · en Planes
              </Link>
            </Fila>
            <Fila etiqueta="Tamaño máximo de un comprobante (MB)">
              <Entrada name="comprobante_mb" type="number" min={1} max={25} valor={limites.comprobante_mb} ancho="w-[100px]" />
            </Fila>
            <Fila etiqueta="Pedir 2FA a todos los administradores de hogar">
              <Conmutador name="exigir_2fa_admins" defaultChecked={limites.exigir_2fa_admins} etiqueta="Pedir 2FA a todos los administradores de hogar" />
            </Fila>
            <Fila etiqueta="Bloquear el ingreso 15 min tras intentos fallidos">
              <Entrada name="intentos_bloqueo" type="number" min={3} max={20} valor={limites.intentos_bloqueo} ancho="w-[100px]" />
            </Fila>
            <p className="pt-2 text-[13px] text-tenue">
              La duración de la sesión de los usuarios se configura en Supabase Auth (Sessions). La 2FA obligatoria aplica cuando la persona renueva su sesión
              (máximo 1 hora).
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}
