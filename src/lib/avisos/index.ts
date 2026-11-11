import type { Contenido } from "@/lib/correo/plantilla";
import { correoDian, correoPlazoDian, correoRecordatorio, correoResumen, correoVencido } from "@/lib/correo/correos";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaLarga, sumarDias } from "@/lib/fechas";
import { proximaFecha, type Repeticion } from "@/lib/recordatorios";
import type { ResultadoTope } from "@/lib/impuestos/tipos";

/**
 * Avisos programados por correo (los corre /api/avisos una vez al día). Función pura: con los datos de un hogar y la
 * fecha decide qué correos salen y a quién. Cada aviso tiene una clave única: el que ya se envió no se repite
 * (tabla avisos_enviados).
 */

export type Persona = { email: string; nombre: string };
export type DatosHogar = {
  hogar: { id: string; nombre: string; resumenSemanal: boolean };
  /** Adultos con acceso que escriben (admin y editor): los contadores no reciben avisos de pagos. */
  personas: Persona[];
  recordatorios: { id: string; nombre: string; fecha: string; monto: number | null; repetir: Repeticion; avisos: number[]; canales: string[]; activo: boolean }[];
  /** Pagos programados que vencieron ayer y siguen sin confirmar. */
  vencidos: { id: string; nombre: string; monto: number; fecha: string; cuenta: string | null }[];
  /** Solo los lunes y si el hogar activó el resumen. */
  semana?: {
    movimientos: { tipo: "ingreso" | "gasto"; monto: number; fecha: string; categoria: string | null }[];
    proximos: { nombre: string; monto: number; fecha: string }[];
  };
  /** Semáforo DIAN del año en curso. */
  dian?: { anio: number; personas: { member_id: string; nombre: string; topes: ResultadoTope[] }[] };
  /** Fecha para declarar el año gravable anterior de quienes deben hacerlo (calendario por los dígitos de la cédula). */
  plazos?: { anio: number; personas: { member_id: string; nombre: string; digitos: string; fecha: string }[] };
};
export type Aviso = { clave: string; tipo: "recordatorio" | "vencido" | "resumen" | "dian"; envios: { para: string; contenido: Contenido }[] };

/** Días antes de la fecha de declarar en que sale el aviso. */
export const DIAS_PLAZO_DIAN = [60, 30, 7];

const MAYUS = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const diaSemana = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 = domingo

/** "Hoy", "Mañana" o "El viernes 20 de noviembre". */
export function cuandoVence(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  return `El ${formatearFechaLarga(fecha)}`;
}

export function planificarAvisos(d: DatosHogar, hoy: string, sitio: string): Aviso[] {
  if (!d.personas.length) return [];
  const avisos: Aviso[] = [];
  const paraTodos = (crear: (p: Persona) => Contenido) => d.personas.map((p) => ({ para: p.email, contenido: crear(p) }));

  // Recordatorios con el canal «correo»: en cada día de anticipación elegido.
  for (const r of d.recordatorios) {
    if (!r.activo || !r.canales.includes("correo")) continue;
    const proxima = proximaFecha(r.fecha, r.repetir, hoy);
    for (const dias of r.avisos) {
      if (sumarDias(hoy, dias) !== proxima) continue;
      const cuando = cuandoVence(proxima, hoy);
      avisos.push({
        clave: `recordatorio:${r.id}:${proxima}:${dias}`,
        tipo: "recordatorio",
        envios: paraTodos((p) =>
          correoRecordatorio({
            nombre: p.nombre,
            hogar: d.hogar.nombre,
            pago: r.nombre,
            monto: r.monto ? formatearCOP(r.monto) : null,
            fecha: MAYUS(formatearFechaLarga(proxima)),
            cuando,
            detalle: r.repetir === "mensual" ? "Se repite cada mes" : r.repetir === "anual" ? "Se repite cada año" : null,
            urlVer: `${sitio}/recordatorios`,
            sitio,
          }),
        ),
      });
    }
  }

  // Pagos fijos que vencieron ayer sin confirmarse.
  const ayer = sumarDias(hoy, -1);
  for (const v of d.vencidos) {
    if (v.fecha !== ayer) continue;
    avisos.push({
      clave: `vencido:${v.id}`,
      tipo: "vencido",
      envios: paraTodos((p) =>
        correoVencido({
          nombre: p.nombre,
          hogar: d.hogar.nombre,
          pago: v.nombre,
          monto: formatearCOP(v.monto),
          vencio: MAYUS(formatearFechaLarga(v.fecha)),
          cuenta: v.cuenta,
          urlPagado: `${sitio}/movimientos/${v.id}`,
          urlVer: `${sitio}/recurrentes`,
          sitio,
        }),
      ),
    });
  }

  // Resumen de la semana pasada (lunes a domingo), los lunes.
  if (d.semana && d.hogar.resumenSemanal && diaSemana(hoy) === 1) {
    const desde = sumarDias(hoy, -7), hasta = sumarDias(hoy, -1), antes = sumarDias(hoy, -14);
    const semana = d.semana.movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta);
    const anterior = d.semana.movimientos.filter((m) => m.fecha >= antes && m.fecha < desde && m.tipo === "gasto");
    const gastos = semana.filter((m) => m.tipo === "gasto");
    const ingresos = semana.filter((m) => m.tipo === "ingreso");
    const total = (l: { monto: number }[]) => l.reduce((s, m) => s + m.monto, 0);
    const porCategoria = new Map<string, number>();
    for (const g of gastos) porCategoria.set(g.categoria ?? "Sin categoría", (porCategoria.get(g.categoria ?? "Sin categoría") ?? 0) + g.monto);
    const mayor = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0];
    const totalGastos = total(gastos), totalAnterior = total(anterior);
    const cambio = totalAnterior ? Math.round(((totalGastos - totalAnterior) / totalAnterior) * 100) : null;
    const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
    const cifras = [
      { k: "Gastos", v: formatearCOP(totalGastos), d: plural(gastos.length, "movimiento", "movimientos") },
      { k: "Ingresos", v: formatearCOP(total(ingresos)), d: plural(ingresos.length, "movimiento", "movimientos") },
      { k: "Mayor gasto", v: mayor?.[0] ?? "—", d: mayor ? formatearCOP(mayor[1]) : "Sin gastos" },
      {
        k: "Frente a la semana anterior",
        v: cambio === null ? "—" : `${cambio > 0 ? "+" : ""}${cambio} %`,
        d: totalAnterior ? `Antes: ${formatearCOP(totalAnterior)}` : "Sin datos de la semana anterior",
      },
    ];
    const proximos = d.semana.proximos
      .filter((x) => x.fecha >= hoy && x.fecha <= sumarDias(hoy, 6))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 6)
      .map((x) => ({ dia: String(Number(x.fecha.slice(8))), pago: `${x.nombre} · ${formatearCOP(x.monto)}`, cuando: MAYUS(formatearFechaLarga(x.fecha).split(" ")[0]) }));
    const [d1, d2] = [formatearFechaLarga(desde), formatearFechaLarga(hasta)];
    const rango = d1.split(" de ")[1] === d2.split(" de ")[1] ? `Del ${d1.split(" de ")[0]} al ${d2}` : `Del ${d1} al ${d2}`;
    avisos.push({
      clave: `resumen:${hoy}`,
      tipo: "resumen",
      envios: paraTodos((p) =>
        correoResumen({
          nombre: p.nombre,
          hogar: d.hogar.nombre,
          rango,
          cifras,
          alerta: cambio !== null && cambio >= 25 ? `Atento: esta semana gastaron un ${cambio} % más que la anterior.` : null,
          proximos,
          url: `${sitio}/`,
          sitio,
          totalGastos: formatearCOP(totalGastos),
        }),
      ),
    });
  }

  // Renta DIAN: la primera vez en el año que una persona alcanza un tope (rojo).
  if (d.dian) {
    for (const persona of d.dian.personas) {
      const rojo = persona.topes.find((t) => t.semaforo === "rojo");
      if (!rojo) continue;
      const cerca = persona.topes.filter((t) => t !== rojo && t.porcentaje >= 70).map((t) => `${t.nombre.toLowerCase()} (${t.porcentaje} %)`);
      avisos.push({
        clave: `dian:${d.dian.anio}:${persona.member_id}`,
        tipo: "dian",
        envios: paraTodos(() =>
          correoDian({
            persona: persona.nombre,
            hogar: d.hogar.nombre,
            anio: d.dian!.anio,
            tope: rojo.nombre,
            valor: formatearCOP(rojo.acumulado),
            topeValor: `${formatearCOP(rojo.tope)} · ${rojo.topeUnidades.toLocaleString("es-CO")} UVT`,
            fecha: MAYUS(formatearFechaLarga(hoy)),
            otros: cerca.length ? `También está cerca de otros topes: ${cerca.join(" y ")}. Ve guardando los soportes desde ya.` : null,
            url: `${sitio}/impuestos`,
            sitio,
          }),
        ),
      });
    }
  }
  // Fecha de declarar: 60, 30 y 7 días antes, a quien debe declarar el año anterior.
  if (d.plazos) {
    for (const p of d.plazos.personas) {
      const dias = DIAS_PLAZO_DIAN.find((n) => sumarDias(hoy, n) === p.fecha);
      if (!dias) continue;
      avisos.push({
        clave: `plazo:${d.plazos.anio}:${p.member_id}:${dias}`,
        tipo: "dian",
        envios: paraTodos(() =>
          correoPlazoDian({
            persona: p.nombre,
            hogar: d.hogar.nombre,
            anio: d.plazos!.anio,
            fecha: MAYUS(formatearFechaLarga(p.fecha)),
            dias,
            digitos: p.digitos,
            url: `${sitio}/impuestos?anio=${d.plazos!.anio}`,
            sitio,
          }),
        ),
      });
    }
  }
  return avisos;
}
