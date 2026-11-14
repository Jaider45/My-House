import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/sesion";

/**
 * «Descargar mis datos» (Configuración → Privacidad y datos, Ley 1581): un JSON con la cuenta, los consentimientos,
 * las solicitudes y los datos del hogar activo. Todo se lee con la sesión de la persona: RLS deja ver solo lo suyo.
 * Los soportes (archivos) no van adentro: se listan con su nombre (se descargan desde cada movimiento).
 */
export async function GET() {
  const ctx = await obtenerContexto();
  const db = ctx.supabase;
  const h = ctx.hogar.id;

  /** Todas las filas de una tabla del hogar, de a 1.000 (el tope de PostgREST). */
  async function todas(tabla: "transactions" | "attachments", columnas: string) {
    const filas: unknown[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db.from(tabla).select(columnas).eq("household_id", h).order("id").range(desde, desde + 999);
      if (error || !data?.length) break;
      filas.push(...data);
      if (data.length < 1000) break;
    }
    return filas;
  }

  const [usuario, consentimientos, contacto, solicitudes, hogar, miembros, cuentas, categorias, reglas, metas, deudas, recordatorios, movimientos, soportes] = await Promise.all([
    db.auth.getUser(),
    db.from("consentimientos").select("tipo, version, aceptado, origen, created_at").order("created_at"),
    db.from("contactos").select("telefono, whatsapp, whatsapp_desde").maybeSingle(),
    db.from("solicitudes_privacidad").select("numero, tipo, estado, recibida, vence, detalle, respuesta").order("created_at"),
    db.from("households").select("nombre, ciudad, pais, moneda, plan, created_at").eq("id", h).single(),
    db.from("members").select("nombre, rol, es_dependiente, parentesco, fecha_nacimiento, created_at").eq("household_id", h),
    db.from("accounts").select("nombre, tipo, subtipo, entidad, ultimos4, saldo_inicial, cupo, dia_corte, dia_pago, archivada, created_at").eq("household_id", h),
    db.from("categories").select("nombre, clase, tipo, esencial, archivada").eq("household_id", h),
    db.from("recurring_rules").select("descripcion, monto, tipo, frecuencia, fecha_inicio, activa").eq("household_id", h),
    db.from("budgets_goals").select("tipo, nombre, monto, periodo, fecha_objetivo, ahorrado_inicial, aporte_mensual").eq("household_id", h),
    db.from("debts").select("nombre, detalle, monto, pagado_inicial, cuota, cuotas_total, dia_pago, archivada").eq("household_id", h),
    db.from("reminders").select("nombre, fecha, monto, repetir, avisos, canales, activo").eq("household_id", h),
    todas("transactions", "fecha, tipo, monto, comercio, nota, estado, origen, ambito, created_at"),
    todas("attachments", "archivo_path, tipo, created_at"),
  ]);

  const u = usuario.data.user;
  const cuerpo = {
    generado: new Date().toISOString(),
    nota: "Copia de tus datos en My House (Ley 1581 de 2012). Si quieres corregir o borrar algo, escríbenos desde Ayuda.",
    cuenta: u ? { correo: u.email, creada: u.created_at, ultimo_ingreso: u.last_sign_in_at } : null,
    consentimientos: consentimientos.data ?? [],
    celular: contacto.data ?? null,
    solicitudes_privacidad: solicitudes.data ?? [],
    hogar: { ...(hogar.data ?? {}), tu_rol: ctx.miembro.rol },
    miembros: miembros.data ?? [],
    cuentas: cuentas.data ?? [],
    categorias: categorias.data ?? [],
    pagos_fijos: reglas.data ?? [],
    presupuestos_y_metas: metas.data ?? [],
    deudas: deudas.data ?? [],
    recordatorios: recordatorios.data ?? [],
    movimientos,
    soportes,
  };
  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(cuerpo, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mis-datos-my-house-${fecha}.json"`,
      "cache-control": "no-store",
    },
  });
}
