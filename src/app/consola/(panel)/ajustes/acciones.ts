"use server";

import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { olvidarConfig } from "@/lib/plataforma/config";

const SIN_PERMISO = "Solo un superadmin cambia los ajustes de la plataforma.";
const EVENTOS = ["pago_fallido", "ticket_urgente", "solicitud_1581", "servicio_caido", "plantilla_rechazada"] as const;
const USOS = ["aviso_equipo", "cobro_mora", "cobro_renovacion", "cobro_gratis"] as const;

const texto = (d: FormData, k: string) => String(d.get(k) ?? "").trim().slice(0, 200);
const si = (d: FormData, k: string) => d.get(k) === "1";
const entero = (d: FormData, k: string) => {
  const v = texto(d, k).replace(/\D/g, "");
  return v ? Number(v) : null;
};

/** Arma el valor de cada ajuste desde su formulario (la base valida forma y rangos y deja auditoría). */
function leer(clave: string, d: FormData): unknown | string {
  switch (clave) {
    case "empresa":
      return Object.fromEntries(["razon_social", "nit", "correo_contacto", "responsable", "ciudad", "direccion", "telefono", "correo_datos", "correo_soporte"].map((k) => [k, texto(d, k)]));
    case "envios":
      return { remitente: texto(d, "remitente"), responder_a: texto(d, "responder_a"), wa_desde: texto(d, "wa_desde"), wa_hasta: texto(d, "wa_hasta"), wa_sin_marketing_domingo: si(d, "wa_sin_marketing_domingo") };
    case "cobro_reintentos": {
      const dias = texto(d, "dias")
        .split(/[^\d]+/)
        .filter(Boolean)
        .map(Number);
      return dias.length ? dias : "Escribe los días, por ejemplo: 1, 3, 7.";
    }
    case "cobro_dia_gratis":
    case "prueba_dias": {
      const n = entero(d, "valor");
      return n === null ? "Escribe un número de días." : n;
    }
    case "factura":
      return { proveedor: texto(d, "proveedor"), resolucion: texto(d, "resolucion"), prefijo: texto(d, "prefijo").toUpperCase(), desde: entero(d, "desde"), hasta: entero(d, "hasta"), enviar_correo: si(d, "enviar_correo") };
    case "avisos_equipo":
      // Roles fijos o propios (id); la base valida que existan.
      return Object.fromEntries(EVENTOS.map((e) => [e, { activo: si(d, `${e}_activo`), whatsapp: si(d, `${e}_whatsapp`), roles: d.getAll(`${e}_rol`).map(String).slice(0, 20) }]));
    case "limites_app":
      return {
        comprobante_mb: entero(d, "comprobante_mb") ?? 10,
        exigir_2fa_admins: si(d, "exigir_2fa_admins"),
        intentos_bloqueo: entero(d, "intentos_bloqueo") ?? 5,
        sesion_dias: entero(d, "sesion_dias") ?? 0,
      };
    case "whatsapp_usos":
      return Object.fromEntries(USOS.map((u) => [u, { plantilla: texto(d, `${u}_plantilla`), variables: d.getAll(`${u}_var`).map(String).slice(0, 10) }]));
    default:
      return "Ese ajuste no existe.";
  }
}

export async function guardarAjuste(_: Estado, datos: FormData): Promise<Estado> {
  const staff = await obtenerStaff();
  const clave = String(datos.get("clave") ?? "");
  // La prueba gratis es una regla de cobro (permiso planes); lo demás es de la plataforma (permiso sistema).
  if (!staff.puede(clave === "prueba_dias" ? "planes" : "sistema")) return { error: SIN_PERMISO };
  const valor = leer(clave, datos);
  if (typeof valor === "string") return { error: valor };
  const { error } =
    clave === "prueba_dias"
      ? await staff.supabase.rpc("consola_guardar_config", { p_clave: clave, p_valor: valor as never })
      : await staff.supabase.rpc("consola_guardar_ajuste", { p_clave: clave, p_valor: valor as never });
  if (error) return { error: mensajeError(error) };
  olvidarConfig(clave);
  revalidatePath("/consola/ajustes");
  if (clave === "empresa") {
    revalidatePath("/terminos");
    revalidatePath("/privacidad");
  }
  return { ok: "Guardado." };
}
