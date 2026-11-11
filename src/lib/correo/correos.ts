import type { Boton, Contenido, Fila, Texto } from "./plantilla";

/**
 * Los correos de My House (diseño «Email» del lienzo), con datos reales. Cada función devuelve el contenido; la
 * plantilla lo convierte en HTML y texto. Los de Supabase (código, restablecer, registro, cambio de correo y
 * contraseña cambiada) reciben variables de Go como texto crudo: ver plantillas-supabase.test.ts.
 */

const CUENTA = "Recibes este correo porque tienes una cuenta en My House.";
/** "Hola Andrés," o "Hola," si no hay nombre. */
const hola = (nombre: string) => (nombre ? `Hola ${nombre},` : "Hola,");
const avisoDe = (hogar: string, sitio: Texto) => ({
  porque: `Recibes este aviso porque eres miembro de ${hogar}.`,
  enlacesPie: [{ texto: "Preferencias de correo", url: [sitio, "/recordatorios"] as Texto }],
});

// ── Acceso (los envía Supabase) ────────────────────────────────────────────────

export function correoCodigo(d: { hola: Texto; codigo: Texto; asuntoCodigo: Texto; minutos: number }): Contenido {
  return {
    asunto: ["Tu código de My House: ", d.asuntoCodigo],
    vistaPrevia: `Úsalo en los próximos ${d.minutos} minutos para entrar.`,
    etiqueta: "Seguridad",
    icono: { nombre: "configuracion", tono: "claro" },
    titulo: "Tu código para entrar",
    intro: [d.hola, " escribe este código en la pantalla de ingreso de My House. Solo sirve una vez."],
    codigo: { valor: d.codigo, nota: `Vence en ${d.minutos} minutos` },
    nota: { texto: "Si no lo pediste, ignora este correo. Nadie puede entrar a tu cuenta sin este código." },
    porque: CUENTA,
  };
}

export function correoRestablecer(d: { hola: Texto; url: Texto; minutos: number }): Contenido {
  return {
    asunto: "Restablece tu contraseña de My House",
    vistaPrevia: `El enlace vence en ${d.minutos} minutos.`,
    etiqueta: "Seguridad",
    icono: { nombre: "configuracion", tono: "claro" },
    titulo: "Restablece tu contraseña",
    intro: [d.hola, " recibimos una solicitud para cambiar la contraseña de tu cuenta. Toca el botón y elige una nueva."],
    botones: [{ texto: "Crear nueva contraseña", url: d.url }],
    enlaceAlterno: d.url,
    nota: {
      texto: `Ábrelo en el mismo dispositivo donde lo pediste. Vence en ${d.minutos} minutos y solo funciona una vez. Si no pediste el cambio, ignora este correo: tu contraseña sigue igual.`,
    },
    porque: CUENTA,
  };
}

export function correoRegistro(d: { hola: Texto; url: Texto; minutos: number }): Contenido {
  return {
    asunto: "Confirma tu correo para activar tu cuenta de My House",
    vistaPrevia: "Un paso más y empiezas a armar tu hogar.",
    etiqueta: "Confirma tu correo",
    icono: { nombre: "casa", tono: "claro" },
    titulo: "Confirma tu correo y entra a tu hogar",
    intro: [d.hola, " gracias por crear tu cuenta en My House. Confirma que este correo es tuyo para activarla y armar tu hogar."],
    botones: [{ texto: "Confirmar mi correo", url: d.url }],
    enlaceAlterno: d.url,
    nota: { texto: `El enlace vence en ${d.minutos} minutos. Si no creaste esta cuenta, ignora este correo y no se activará.` },
    porque: "Recibes este correo porque alguien creó una cuenta en My House con esta dirección.",
  };
}

export function correoCambioCorreo(d: { hola: Texto; url: Texto; actual: Texto; nuevo: Texto }): Contenido {
  return {
    asunto: "Confirma tu correo nuevo en My House",
    vistaPrevia: "Confirma el cambio para seguir entrando con esta dirección.",
    etiqueta: "Seguridad",
    icono: { nombre: "casa", tono: "claro" },
    titulo: "Confirma tu correo nuevo",
    intro: [d.hola, " pediste cambiar el correo de tu cuenta."],
    tarjeta: { filas: [{ k: "Correo actual", v: d.actual }, { k: "Correo nuevo", v: d.nuevo }] },
    botones: [{ texto: "Confirmar el cambio", url: d.url }],
    enlaceAlterno: d.url,
    nota: { texto: "Si no pediste este cambio, ignora este correo: tu cuenta sigue con el correo actual." },
    porque: CUENTA,
  };
}

export function correoContrasena(d: { hola: Texto; urlRecuperar: Texto }): Contenido {
  return {
    asunto: "Tu contraseña de My House cambió",
    vistaPrevia: "Si no fuiste tú, recupera tu cuenta ahora.",
    etiqueta: "Seguridad",
    icono: { nombre: "configuracion", tono: "claro" },
    titulo: "Tu contraseña cambió",
    intro: [d.hola, " la contraseña de tu cuenta acaba de cambiar. Si fuiste tú, no tienes que hacer nada."],
    nota: { texto: "Si no hiciste este cambio, recupera tu cuenta de inmediato: al crear una contraseña nueva puedes cerrar la sesión en todos tus dispositivos.", tono: "error" },
    botones: [{ texto: "No fui yo: recuperar mi cuenta", url: d.urlRecuperar }],
    porque: CUENTA,
  };
}

// ── Los envía la app ───────────────────────────────────────────────────────────

export function correoBienvenida(d: {
  nombre: string;
  hogar: string;
  minimo: string | null;
  fijosTotal: string;
  fijosCantidad: number;
  url: string;
}): Contenido {
  const filas: Fila[] = [];
  if (d.minimo) filas.push({ k: "Número mínimo del hogar", v: d.minimo, grande: true });
  if (d.fijosCantidad) filas.push({ k: "Pagos fijos del mes", v: d.fijosTotal, grande: !d.minimo }, { k: "Pagos fijos cargados", v: String(d.fijosCantidad) });
  return {
    asunto: `${d.hogar} ya está listo`,
    vistaPrevia: d.minimo ? `Tu número mínimo del hogar es ${d.minimo} al mes.` : "Registra tu primer gasto y conoce cuánto cuesta sostener la casa.",
    etiqueta: "Bienvenida",
    icono: { nombre: "casa", tono: "monte" },
    titulo: `Te damos la bienvenida a My House, ${d.nombre}`,
    intro: d.fijosCantidad
      ? "Con los pagos fijos que cargaste ya sabemos cuánto cuesta sostener la casa cada mes."
      : "Tu hogar está listo. Con tus primeros pagos fijos y gastos sabrás cuánto cuesta sostener la casa cada mes.",
    tarjeta: filas.length ? { filas, tono: "ok" } : undefined,
    lista: {
      titulo: "Lo que sigue",
      items: [
        { n: "1", t: "Registra tu primer gasto", d: "Toma menos de 10 segundos desde el botón Registrar." },
        { n: "2", t: "Invita a tu pareja", d: "Registren los dos y vean las mismas cuentas." },
        { n: "3", t: "Sube un comprobante", d: "El asistente lo lee, lo registra y lo categoriza." },
      ],
    },
    botones: [{ texto: "Ir a mi resumen", url: d.url }],
    porque: CUENTA,
  };
}

const ROLES = {
  admin: { rol: "Administrador", puede: "Todo, incluso invitar y quitar miembros" },
  editor: { rol: "Editor", puede: "Registrar y editar gastos, pagos y metas" },
} as const;

export function correoInvitacion(d: { quien: string; hogar: string; rol: "admin" | "editor"; url: string; vence: string }): Contenido {
  return {
    asunto: `${d.quien} te invitó a ${d.hogar}`,
    vistaPrevia: "Acepta para registrar gastos y ver las cuentas de la casa.",
    etiqueta: "Invitación",
    icono: { nombre: "familia", tono: "claro" },
    titulo: `${d.quien} te invitó a su hogar en My House`,
    intro: `Hola, ${d.quien} quiere que lleven juntos las cuentas de la casa: gastos, pagos fijos, metas y renta.`,
    tarjeta: { filas: [{ k: "Hogar", v: d.hogar }, { k: "Tu rol", v: ROLES[d.rol].rol }, { k: "Puedes", v: ROLES[d.rol].puede }] },
    botones: [{ texto: "Aceptar invitación", url: d.url }],
    enlaceAlterno: d.url,
    nota: { texto: `La invitación vence el ${d.vence}. Si no conoces a ${d.quien}, ignora este correo.` },
    porque: `Recibes este correo porque ${d.quien} escribió tu dirección en My House.`,
  };
}

export function correoContador(d: { quien: string; hogar: string; url: string; vence: string; anio: number }): Contenido {
  return {
    asunto: `${d.quien} te dio acceso de solo lectura a su hogar`,
    vistaPrevia: `Movimientos, Renta DIAN y soportes del año gravable ${d.anio}.`,
    etiqueta: "Acceso de contador",
    icono: { nombre: "declaracion-renta", tono: "claro" },
    titulo: "Tienes acceso de solo lectura",
    intro: `Hola, ${d.quien} te dio acceso como contador a ${d.hogar} para preparar la declaración de renta.`,
    lista: {
      titulo: "Qué puedes ver",
      items: [
        { n: "1", t: "Movimientos", d: "Con sus etiquetas DIAN y totales por año." },
        { n: "2", t: "Renta DIAN", d: "Topes, UVT y estado de cada miembro." },
        { n: "3", t: "Soportes", d: "Certificados, extractos y facturas adjuntos." },
      ],
    },
    nota: { texto: `No puedes editar nada ni ver la configuración del hogar. ${d.quien} puede quitarte el acceso cuando quiera. La invitación vence el ${d.vence}.` },
    botones: [{ texto: "Aceptar y ver el hogar", url: d.url }],
    enlaceAlterno: d.url,
    porque: `Recibes este correo porque ${d.quien} te invitó como contador.`,
  };
}

/** Invitación al equipo de My House (consola). Exige 2FA: se avisa desde el correo. */
export function correoEquipo(d: { quien: string; nombre: string; rol: string; url: string; vence: string }): Contenido {
  return {
    asunto: `${d.quien} te invitó al equipo de My House`,
    vistaPrevia: `Acceso a la consola con el rol ${d.rol}.`,
    etiqueta: "Equipo",
    icono: { nombre: "configuracion", tono: "claro" },
    titulo: `Hola ${d.nombre}, te invitaron a la consola de My House`,
    intro: `${d.quien} te dio acceso a la consola de administración con el rol ${d.rol}.`,
    tarjeta: { filas: [{ k: "Rol", v: d.rol }, { k: "Vence", v: d.vence }] },
    botones: [{ texto: "Aceptar invitación", url: d.url }],
    enlaceAlterno: d.url,
    nota: { texto: "Al entrar activarás la verificación en dos pasos: es obligatoria para el equipo. Si no esperabas este correo, ignóralo." },
    porque: `Recibes este correo porque ${d.quien} escribió tu dirección en la consola de My House.`,
  };
}

export function correoSeguridad(d: { nombre: string; dispositivo: string; lugar: string | null; fecha: string; urlProteger: string; urlSitio: string }): Contenido {
  const filas: Fila[] = [{ k: "Dispositivo", v: d.dispositivo }];
  if (d.lugar) filas.push({ k: "Lugar aproximado", v: d.lugar });
  filas.push({ k: "Fecha", v: d.fecha });
  return {
    asunto: "Nuevo inicio de sesión en tu cuenta de My House",
    vistaPrevia: [d.dispositivo, d.lugar ? ` · ${d.lugar}` : "", "."],
    etiqueta: "Seguridad",
    icono: { nombre: "alertas", tono: "alerta" },
    titulo: "¿Fuiste tú?",
    intro: `${hola(d.nombre)} alguien entró a tu cuenta desde un dispositivo o navegador nuevo.`,
    tarjeta: { filas },
    nota: { texto: "Si fuiste tú, no tienes que hacer nada. Si no, crea una contraseña nueva ahora y marca «Cerrar sesión en mis otros dispositivos»." },
    botones: [
      { texto: "No fui yo: proteger mi cuenta", url: d.urlProteger },
      { texto: "Sí fui yo", url: d.urlSitio },
    ],
    porque: CUENTA,
  };
}

export function correoRecordatorio(d: {
  nombre: string;
  hogar: string;
  pago: string;
  monto: string | null;
  fecha: string;
  cuando: string;
  detalle: string | null;
  urlVer: string;
  sitio: string;
}): Contenido {
  const filas: Fila[] = [];
  if (d.monto) filas.push({ k: "Monto", v: d.monto, grande: true });
  filas.push({ k: "Pago", v: d.pago }, { k: "Fecha límite", v: d.fecha });
  if (d.detalle) filas.push({ k: "Detalle", v: d.detalle });
  return {
    asunto: d.monto ? `${d.cuando} vence ${d.pago}: ${d.monto}` : `${d.cuando} vence ${d.pago}`,
    vistaPrevia: `Fecha límite: ${d.fecha}.`,
    etiqueta: "Recordatorio",
    icono: { nombre: "calendario", tono: "claro" },
    titulo: `${d.pago} vence ${d.cuando.toLowerCase()}`,
    intro: `${hola(d.nombre)} te avisamos con tiempo para que no se te pase.`,
    tarjeta: { filas },
    botones: [{ texto: "Ver mis recordatorios", url: d.urlVer }],
    ...avisoDe(d.hogar, d.sitio),
  };
}

export function correoVencido(d: {
  nombre: string;
  hogar: string;
  pago: string;
  monto: string;
  vencio: string;
  cuenta: string | null;
  urlPagado: string;
  urlVer: string;
  sitio: string;
}): Contenido {
  const filas: Fila[] = [{ k: "Monto", v: d.monto, grande: true, tono: "error" }, { k: "Venció", v: d.vencio }];
  if (d.cuenta) filas.push({ k: "Se paga desde", v: d.cuenta });
  return {
    asunto: `${d.pago} venció ayer: ${d.monto}`,
    vistaPrevia: "Si ya lo pagaste, márcalo como pagado.",
    etiqueta: "Pago vencido",
    icono: { nombre: "alertas", tono: "error" },
    titulo: `${d.pago} venció ayer`,
    intro: `${hola(d.nombre)} este pago fijo tenía fecha límite el ${d.vencio.toLowerCase()} y todavía aparece pendiente.`,
    tarjeta: { filas, tono: "error" },
    botones: [
      { texto: "Marcar como pagado", url: d.urlPagado },
      { texto: "Ver pagos fijos", url: d.urlVer },
    ],
    nota: { texto: "Si ya lo pagaste, márcalo como pagado y adjunta el comprobante para tenerlo a mano en la declaración." },
    ...avisoDe(d.hogar, d.sitio),
  };
}

export function correoResumen(d: {
  nombre: string;
  hogar: string;
  rango: string;
  cifras: { k: string; v: string; d: string }[];
  alerta: string | null;
  proximos: { dia: string; pago: string; cuando: string }[];
  url: string;
  sitio: string;
  totalGastos: string;
}): Contenido {
  return {
    asunto: `Tu semana en la casa: ${d.totalGastos} en gastos`,
    vistaPrevia: d.proximos.length ? `${d.rango} · ${d.proximos.length === 1 ? "1 pago vence" : `${d.proximos.length} pagos vencen`} esta semana.` : d.rango,
    etiqueta: "Resumen semanal",
    icono: { nombre: "resumen", tono: "claro" },
    titulo: "Tu semana en la casa",
    intro: `${hola(d.nombre).replace(/,$/, ".")} ${d.rango}.`,
    cifras: d.cifras,
    nota: d.alerta ? { texto: d.alerta, tono: "alerta" } : undefined,
    lista: d.proximos.length ? { titulo: "Vence esta semana", items: d.proximos.map((x) => ({ n: x.dia, t: x.pago, d: x.cuando })) } : undefined,
    botones: [{ texto: "Ver mi resumen", url: d.url }],
    porque: `Recibes este resumen los lunes porque lo activaste en Recordatorios de ${d.hogar}.`,
    enlacesPie: [{ texto: "Dejar de recibir el resumen", url: `${d.sitio}/recordatorios` }],
  };
}

export function correoDian(d: {
  persona: string;
  hogar: string;
  anio: number;
  tope: string;
  valor: string;
  topeValor: string;
  fecha: string;
  otros: string | null;
  url: string;
  sitio: string;
}): Contenido {
  return {
    asunto: `${d.persona} deberá declarar renta en ${d.anio + 1}`,
    vistaPrevia: `Superó el tope de ${d.tope.toLowerCase()} del año ${d.anio}.`,
    etiqueta: "Renta DIAN",
    icono: { nombre: "declaracion-renta", tono: "error" },
    titulo: `${d.persona} superó el tope de ${d.tope.toLowerCase()}`,
    intro: `Con los movimientos registrados, ${d.persona} ya pasó uno de los topes del año ${d.anio}. Le tocará declarar renta en ${d.anio + 1}.`,
    tarjeta: { filas: [{ k: `${d.tope} ${d.anio}`, v: d.valor, grande: true, tono: "error" }, { k: "Tope", v: d.topeValor }, { k: "Detectado el", v: d.fecha }] },
    nota: { texto: d.otros ?? "Ve guardando desde ya los certificados y soportes del año." },
    botones: [{ texto: "Ver Renta DIAN", url: d.url }],
    meta: "Cálculo orientativo con base en lo registrado en My House. La decisión final de declarar es tuya y de tu contador.",
    ...avisoDe(d.hogar, d.sitio),
  };
}

/** Faltan 60, 30 o 7 días para la fecha de declarar de una persona que debe hacerlo (calendario DIAN por cédula). */
export function correoPlazoDian(d: { persona: string; hogar: string; anio: number; fecha: string; dias: number; digitos: string; url: string; sitio: string }): Contenido {
  const cuando = d.dias === 7 ? "en una semana" : `en ${d.dias} días`;
  return {
    asunto: `${d.persona}: la declaración de renta vence ${cuando}`,
    vistaPrevia: `Fecha límite: ${d.fecha} (cédula terminada en ${d.digitos}).`,
    etiqueta: "Renta DIAN",
    icono: { nombre: "declaracion-renta", tono: d.dias === 7 ? "error" : "alerta" },
    titulo: `La declaración de ${d.persona} vence ${cuando}`,
    intro: `Según el calendario de la DIAN, ${d.persona} declara la renta del año ${d.anio} a más tardar el ${d.fecha}.`,
    tarjeta: { filas: [{ k: "Fecha límite", v: d.fecha, grande: true, ...(d.dias === 7 && { tono: "error" as const }) }, { k: "Cédula terminada en", v: d.digitos }, { k: "Año gravable", v: String(d.anio) }] },
    nota: { texto: d.dias === 7 ? "Si ya la presentaste, ignora este correo." : "Revisa en Renta DIAN los totales por etiqueta y comparte los soportes con tu contador." },
    botones: [{ texto: "Ver Renta DIAN", url: d.url }],
    meta: "Fecha tomada del calendario tributario publicado por la DIAN. Confírmala con tu contador.",
    ...avisoDe(d.hogar, d.sitio),
  };
}

/** Diseño listo; la app aún no genera el reporte para el contador (Fase 2). Solo se usa en la vista previa. */
export function correoReporte(d: { nombre: string; hogar: string; anio: number; archivos: { nombre: string; tamano: string }[]; url: string; sitio: string }): Contenido {
  return {
    asunto: `El reporte de renta ${d.anio} está listo`,
    vistaPrevia: "PDF y Excel con topes, totales por etiqueta y soportes.",
    etiqueta: "Reporte listo",
    icono: { nombre: "documentos", tono: "claro" },
    titulo: "Tu reporte para el contador está listo",
    intro: `${hola(d.nombre)} armamos el reporte del año gravable ${d.anio} con lo registrado hasta hoy.`,
    tarjeta: { filas: d.archivos.map((a) => ({ k: a.nombre, v: a.tamano })) },
    botones: [{ texto: "Descargar el reporte", url: d.url }],
    nota: { texto: "Los enlaces vencen en 7 días. Puedes generar el reporte de nuevo cuando quieras desde Renta DIAN." },
    ...avisoDe(d.hogar, d.sitio),
  };
}

// ── Plan y cobros (SaaS S3; los envían el webhook de Wompi y el cron /api/cobros) ─────────────────────────────

type DatosPlan = { nombre: string; hogar: string; plan: string; urlPlan: string; sitio: string };
const porqueAdmin = (hogar: string) => ({ porque: `Recibes este correo porque administras ${hogar} en My House.` });

export function correoPagoRecibido(d: DatosPlan & { monto: string; periodo: string; hasta: string; metodo: string | null; referencia: string }): Contenido {
  const filas: Fila[] = [
    { k: "Pagaste", v: d.monto, grande: true },
    { k: "Plan", v: `${d.plan} ${d.periodo}` },
    { k: "Activo hasta", v: d.hasta },
  ];
  if (d.metodo) filas.push({ k: "Medio de pago", v: d.metodo });
  filas.push({ k: "Referencia", v: d.referencia });
  return {
    asunto: `Recibimos tu pago: plan ${d.plan} hasta el ${d.hasta}`,
    vistaPrevia: "Gracias por apoyar My House.",
    etiqueta: "Pago recibido",
    icono: { nombre: "resumen", tono: "claro" },
    titulo: "Recibimos tu pago",
    intro: `${hola(d.nombre)} ${d.hogar} sigue en el plan ${d.plan}. Gracias por confiar en My House.`,
    tarjeta: { filas, tono: "ok" },
    botones: [{ texto: "Ver mi plan", url: d.urlPlan }],
    nota: { texto: "La factura electrónica te llegará por separado cuando la emitamos." },
    ...porqueAdmin(d.hogar),
  };
}

export function correoRenovacion(d: DatosPlan & { monto: string; vence: string; periodo: string }): Contenido {
  return {
    asunto: `Tu plan ${d.plan} vence el ${d.vence}: ${d.monto}`,
    vistaPrevia: "Págalo con tarjeta, PSE, Nequi o Daviplata.",
    etiqueta: "Renovación",
    icono: { nombre: "calendario", tono: "claro" },
    titulo: `Tu plan ${d.plan} vence el ${d.vence}`,
    intro: `${hola(d.nombre)} para que ${d.hogar} siga con el plan ${d.plan}, paga el siguiente periodo antes de esa fecha.`,
    tarjeta: { filas: [{ k: "Valor", v: d.monto, grande: true }, { k: "Periodo", v: d.periodo }, { k: "Vence", v: d.vence }] },
    botones: [{ texto: "Pagar ahora", url: d.urlPlan }],
    enlaceAlterno: d.urlPlan,
    nota: { texto: "Si no quieres renovar, no hagas nada: al vencer seguirás con el plan Gratis y tus datos se conservan." },
    ...porqueAdmin(d.hogar),
  };
}

export function correoMora(d: DatosPlan & { monto: string | null; vencio: string; baja: string; dia: number }): Contenido {
  const ultimo = d.dia >= 7;
  return {
    asunto: ultimo ? `Último aviso: el ${d.baja} tu hogar pasa a Gratis` : `No hemos recibido el pago de tu plan ${d.plan}`,
    vistaPrevia: `Tienes hasta el ${d.baja} para pagar sin perder tu plan.`,
    etiqueta: "Pago pendiente",
    icono: { nombre: "alertas", tono: ultimo ? "error" : "alerta" },
    titulo: ultimo ? "Tu plan está por pasar a Gratis" : "Tu pago está pendiente",
    intro: `${hola(d.nombre)} el plan ${d.plan} de ${d.hogar} venció el ${d.vencio} y aún no vemos el pago.`,
    tarjeta: {
      filas: [...(d.monto ? [{ k: "Valor", v: d.monto, grande: true, tono: "error" as const }] : []), { k: "Venció", v: d.vencio }, { k: "Pasa a Gratis", v: d.baja }],
      tono: "error",
    },
    botones: [{ texto: "Pagar ahora", url: d.urlPlan }],
    enlaceAlterno: d.urlPlan,
    nota: { texto: "Si pasa a Gratis, tus datos se conservan; solo se apagan el asistente de comprobantes ilimitado, las metas y el reporte de renta.", tono: "alerta" },
    ...porqueAdmin(d.hogar),
  };
}

export function correoPlanGratis(d: DatosPlan & { motivo: "mora" | "cancelada" }): Contenido {
  return {
    asunto: `${d.hogar} pasó al plan Gratis`,
    vistaPrevia: "Tus datos siguen ahí. Vuelve a Familia cuando quieras.",
    etiqueta: "Plan Gratis",
    icono: { nombre: "casa", tono: "claro" },
    titulo: "Tu hogar pasó al plan Gratis",
    intro:
      d.motivo === "mora"
        ? `${hola(d.nombre)} no recibimos el pago del plan ${d.plan}, así que ${d.hogar} quedó en el plan Gratis.`
        : `${hola(d.nombre)} como lo pediste, ${d.hogar} quedó en el plan Gratis al terminar el periodo pagado.`,
    nota: { texto: "Tus movimientos, cuentas y soportes se conservan. Puedes volver al plan Familia en cualquier momento." },
    botones: [{ texto: "Volver a Familia", url: d.urlPlan }],
    ...porqueAdmin(d.hogar),
  };
}

export function correoPruebaTermina(d: DatosPlan & { hasta: string; precio: string }): Contenido {
  return {
    asunto: `Tu prueba de Familia termina el ${d.hasta}`,
    vistaPrevia: `Sigue con Familia por ${d.precio} al mes.`,
    etiqueta: "Prueba",
    icono: { nombre: "calendario", tono: "claro" },
    titulo: "Tu prueba de Familia está por terminar",
    intro: `${hola(d.nombre)} la prueba del plan Familia de ${d.hogar} termina el ${d.hasta}. Después seguirás en Gratis, sin cobros automáticos.`,
    tarjeta: { filas: [{ k: "Plan Familia", v: `${d.precio} al mes` }, { k: "Termina", v: d.hasta }] },
    botones: [{ texto: "Seguir con Familia", url: d.urlPlan }],
    ...porqueAdmin(d.hogar),
  };
}

/** Campaña (consola → Comunicaciones). Solo llega a hogares que activaron «Novedades» en Recordatorios. */
export function correoCampana(d: { nombre: string; asunto: string; titulo: string; cuerpo: string; botonTexto?: string | null; botonUrl?: string | null; sitio: string }): Contenido {
  const url = d.botonUrl ? (d.botonUrl.startsWith("/") ? `${d.sitio}${d.botonUrl}` : d.botonUrl) : null;
  return {
    asunto: d.asunto,
    vistaPrevia: d.cuerpo.slice(0, 120),
    etiqueta: "Novedades",
    icono: { nombre: "casa", tono: "claro" },
    titulo: d.titulo,
    intro: `${d.nombre ? `Hola ${d.nombre}, ` : "Hola, "}${d.cuerpo}`,
    ...(url && d.botonTexto ? { botones: [{ texto: d.botonTexto, url }] as [Boton] } : {}),
    porque: "Recibes este correo porque tu hogar activó «Novedades y promociones» en My House.",
    enlacesPie: [{ texto: "Dejar de recibir novedades", url: `${d.sitio}/recordatorios` }],
  };
}
