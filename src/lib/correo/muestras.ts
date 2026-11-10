import * as c from "./correos";
import type { Contenido } from "./plantilla";

/** Datos de ejemplo de cada correo (los del diseño): vista previa en /dev/correos y pruebas. */
export function muestras(sitio: string): Record<string, { nombre: string; contenido: Contenido }> {
  const plan = { nombre: "Andrés", hogar: "Hogar Martínez Rojas", plan: "Familia", urlPlan: `${sitio}/ajustes/plan`, sitio };
  return {
    codigo: { nombre: "Código para entrar", contenido: c.correoCodigo({ hola: "Hola Andrés,", codigo: "482 913", asuntoCodigo: "482913", minutos: 30 }) },
    restablecer: { nombre: "Restablecer contraseña", contenido: c.correoRestablecer({ hola: "Hola Andrés,", url: `${sitio}/auth/confirmar?code=demo`, minutos: 30 }) },
    registro: { nombre: "Confirmar correo (registro)", contenido: c.correoRegistro({ hola: "Hola Andrés,", url: `${sitio}/auth/confirmar?code=demo`, minutos: 30 }) },
    "cambio-correo": {
      nombre: "Cambio de correo",
      contenido: c.correoCambioCorreo({ hola: "Hola Andrés,", url: `${sitio}/auth/confirmar?code=demo`, actual: "andres@correo.co", nuevo: "andres.martinez@correo.co" }),
    },
    contrasena: { nombre: "Contraseña cambiada", contenido: c.correoContrasena({ hola: "Hola Andrés,", urlRecuperar: `${sitio}/recuperar` }) },
    bienvenida: {
      nombre: "Bienvenida",
      contenido: c.correoBienvenida({ nombre: "Andrés", hogar: "Hogar Martínez Rojas", minimo: "$ 8.209.933", fijosTotal: "$ 7.463.575", fijosCantidad: 15, url: `${sitio}/` }),
    },
    invitacion: {
      nombre: "Invitación",
      contenido: c.correoInvitacion({ quien: "Andrés", hogar: "Hogar Martínez Rojas", rol: "editor", url: `${sitio}/invitacion/demo`, vence: "viernes 13 de noviembre" }),
    },
    contador: {
      nombre: "Acceso de contador",
      contenido: c.correoContador({ quien: "Andrés", hogar: "Hogar Martínez Rojas", url: `${sitio}/invitacion/demo`, vence: "viernes 13 de noviembre", anio: 2026 }),
    },
    equipo: {
      nombre: "Invitación al equipo (consola)",
      contenido: c.correoEquipo({ quien: "Jaider", nombre: "Daniela", rol: "Soporte", url: `${sitio}/consola/invitacion/demo`, vence: "lunes 16 de noviembre" }),
    },
    campana: {
      nombre: "Campaña (novedades)",
      contenido: c.correoCampana({ nombre: "Andrés", asunto: "Llega la temporada de renta", titulo: "Llega la temporada de renta", cuerpo: "Desde agosto, la DIAN empieza a llamar a lista. Con el plan Familia tienes el semáforo al día y el reporte anual listo para tu contador.", botonTexto: "Ver planes", botonUrl: "/ajustes/plan", sitio }),
    },
    "pago-recibido": {
      nombre: "Pago recibido (plan)",
      contenido: c.correoPagoRecibido({ ...plan, monto: "$ 19.900", periodo: "mensual", hasta: "10 dic 2026", metodo: "Tarjeta VISA ···4242", referencia: "MH-7F2A91C04B11" }),
    },
    renovacion: { nombre: "Renovación del plan", contenido: c.correoRenovacion({ ...plan, monto: "$ 19.900", vence: "10 dic 2026", periodo: "Mensual" }) },
    mora: { nombre: "Pago del plan pendiente (día 7)", contenido: c.correoMora({ ...plan, monto: "$ 19.900", vencio: "10 dic 2026", baja: "24 dic 2026", dia: 7 }) },
    "plan-gratis": { nombre: "Pasó al plan Gratis", contenido: c.correoPlanGratis({ ...plan, motivo: "mora" }) },
    "prueba-termina": { nombre: "Prueba por terminar", contenido: c.correoPruebaTermina({ ...plan, hasta: "24 nov 2026", precio: "$ 19.900" }) },
    seguridad: {
      nombre: "Nuevo inicio de sesión",
      contenido: c.correoSeguridad({ nombre: "Andrés", dispositivo: "Chrome en Android", lugar: "Medellín, Colombia", fecha: "6 nov 2026, 7:31 a. m.", urlProteger: `${sitio}/recuperar`, urlSitio: `${sitio}/` }),
    },
    recordatorio: {
      nombre: "Recordatorio de pago",
      contenido: c.correoRecordatorio({ nombre: "Andrés", hogar: "Hogar Martínez Rojas", pago: "Tarjeta Visa", monto: "$ 520.000", fecha: "Viernes 20 de noviembre", cuando: "El viernes 20 de noviembre", detalle: "Se repite cada mes", urlVer: `${sitio}/recordatorios`, sitio }),
    },
    vencido: {
      nombre: "Pago vencido",
      contenido: c.correoVencido({ nombre: "Andrés", hogar: "Hogar Martínez Rojas", pago: "Sistecredito", monto: "$ 587.000", vencio: "Martes 17 de noviembre", cuenta: "Bancolombia Ahorros", urlPagado: `${sitio}/movimientos`, urlVer: `${sitio}/recurrentes`, sitio }),
    },
    resumen: {
      nombre: "Resumen semanal",
      contenido: c.correoResumen({
        nombre: "Andrés",
        hogar: "Hogar Martínez Rojas",
        rango: "Del lunes 9 al domingo 15 de noviembre",
        cifras: [
          { k: "Gastos", v: "$ 2.045.220", d: "6 movimientos" },
          { k: "Ingresos", v: "$ 700.000", d: "1 movimiento" },
          { k: "Mayor gasto", v: "Mercado", d: "$ 1.200.000" },
          { k: "Frente a la semana anterior", v: "+28 %", d: "Antes: $ 1.598.000" },
        ],
        alerta: "Atento: esta semana gastaron un 28 % más que la anterior.",
        proximos: [
          { dia: "17", pago: "Sistecredito · $ 587.000", cuando: "Martes" },
          { dia: "20", pago: "Tarjeta Visa · $ 520.000", cuando: "Viernes" },
        ],
        url: `${sitio}/`,
        sitio,
        totalGastos: "$ 2.045.220",
      }),
    },
    dian: {
      nombre: "Renta DIAN",
      contenido: c.correoDian({
        persona: "Andrés",
        hogar: "Hogar Martínez Rojas",
        anio: 2026,
        tope: "Ingresos brutos",
        valor: "$ 84.150.000",
        topeValor: "$ 73.323.600 · 1.400 UVT",
        fecha: "Miércoles 14 de octubre",
        otros: "También está cerca de otros topes: compras y consumos (91 %) y consignaciones (80 %). Ve guardando los soportes desde ya.",
        url: `${sitio}/impuestos`,
        sitio,
      }),
    },
    reporte: {
      nombre: "Reporte para el contador (diseño, sin función aún)",
      contenido: c.correoReporte({
        nombre: "Andrés",
        hogar: "Hogar Martínez Rojas",
        anio: 2026,
        archivos: [
          { nombre: "Reporte_Renta_2026.pdf", tamano: "1,8 MB" },
          { nombre: "Totales_etiquetas_2026.xlsx", tamano: "96 KB" },
          { nombre: "Soportes_2026.zip", tamano: "7 archivos · 4,2 MB" },
        ],
        url: `${sitio}/impuestos`,
        sitio,
      }),
    },
  };
}
