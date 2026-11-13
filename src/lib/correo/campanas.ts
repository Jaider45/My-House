import "server-only";
import type { Servicio } from "@/lib/supabase/servicio";
import { formatearCOP } from "@/lib/dinero";
import { montoMensual, type Frecuencia } from "@/lib/recurrentes";
import { administradores } from "@/lib/pagos/servidor";
import type { Contenido } from "./plantilla";
import { bloquesConVariables, conVariables, variante, type BloqueCorreo, type Variables } from "./bloques";
import { correoCampana } from "./correos";

export type CampanaEnvio = {
  id: string;
  asunto: string;
  asunto_b: string | null;
  prueba_ab_pct: number;
  vista_previa: string | null;
  bloques: BloqueCorreo[] | null;
  titulo: string;
  cuerpo: string;
  boton_texto: string | null;
  boton_url: string | null;
  transaccional: boolean;
};

/** Quién recibe en un hogar: los administradores (novedades) o todas las personas con cuenta (avisos legales). */
export async function destinatarios(db: Servicio, hogar: string, transaccional: boolean) {
  if (!transaccional) return administradores(db, hogar);
  const { data: miembros } = await db.from("members").select("nombre, user_id, households(nombre)").eq("household_id", hogar).not("user_id", "is", null);
  const ids = (miembros ?? []).map((m) => m.user_id!);
  if (!ids.length) return [];
  const { data: correos } = await db.rpc("correos_de_usuarios", { p_ids: ids });
  const porId = new Map((correos ?? []).map((c) => [c.id, c.email]));
  return (miembros ?? [])
    .filter((m) => porId.get(m.user_id!))
    .map((m) => ({ nombre: m.nombre.split(/\s+/)[0], email: porId.get(m.user_id!)!, hogar: m.households?.nombre ?? "tu hogar" }));
}

/** {hogar}, {plan}, {fecha_pago} y {minimo} (pagos fijos del mes + cuota de imprevistos, como en la bienvenida). */
export async function variablesHogar(db: Servicio, hogar: string): Promise<Variables> {
  const [{ data: h }, { data: reglas }, { data: s }] = await Promise.all([
    db.from("households").select("nombre, plan, config, planes(nombre)").eq("id", hogar).single(),
    db.from("recurring_rules").select("monto, frecuencia").eq("household_id", hogar).eq("activa", true).eq("tipo", "gasto"),
    db.from("suscripciones").select("vence").eq("household_id", hogar).maybeSingle(),
  ]);
  const fijos = (reglas ?? []).reduce((t, r) => t + montoMensual(r.monto, r.frecuencia as Frecuencia), 0);
  const pct = Number((h?.config as { cuota_imprevistos_pct?: number } | null)?.cuota_imprevistos_pct ?? 10);
  return {
    hogar: h?.nombre,
    plan: (h?.planes as { nombre?: string } | null)?.nombre ?? h?.plan ?? undefined,
    minimo: fijos ? formatearCOP(fijos + Math.round((fijos * pct) / 100)) : undefined,
    fecha_pago: s?.vence ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${s.vence}T12:00:00Z`)) : undefined,
  };
}

/** Correo de una campaña para una persona (bloques del editor o el formato simple de antes). */
export function contenidoCampana(c: CampanaEnvio, vars: Variables, v: "a" | "b", sitio: string): Contenido {
  const asunto = conVariables(v === "b" && c.asunto_b ? c.asunto_b : c.asunto, vars);
  const pie = c.transaccional
    ? { porque: "Recibes este correo porque tienes una cuenta en My House. Es un aviso obligatorio, no publicidad.", enlacesPie: [] }
    : {
        porque: "Recibes este correo porque aceptaste comunicaciones de My House.",
        enlacesPie: [
          { texto: "Dejar de recibirlos", url: `${sitio}/recordatorios` },
          { texto: "Política de datos", url: `${sitio}/privacidad` },
        ],
      };
  if (!c.bloques?.length) {
    const base = correoCampana({ nombre: vars.nombre ?? "", asunto, titulo: conVariables(c.titulo, vars), cuerpo: conVariables(c.cuerpo, vars), botonTexto: c.boton_texto, botonUrl: c.boton_url, sitio });
    return { ...base, ...pie };
  }
  const bloques = bloquesConVariables(c.bloques, vars);
  const i = bloques.findIndex((b) => b.tipo === "titulo");
  const titulo = i >= 0 ? (bloques[i] as { texto: string }).texto : asunto;
  const resto = bloques.filter((_, j) => j !== i);
  const primerTexto = resto.find((b) => b.tipo === "texto") as { texto: string } | undefined;
  return {
    asunto,
    vistaPrevia: conVariables(c.vista_previa ?? primerTexto?.texto.slice(0, 120) ?? "", vars),
    etiqueta: c.transaccional ? "Aviso" : "Novedades",
    titulo,
    intro: "",
    bloques: resto,
    ...pie,
  };
}

export { variante };
