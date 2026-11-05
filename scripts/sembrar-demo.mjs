// Hogar de demostración con datos de prueba (solo Supabase local). Uso: node scripts/sembrar-demo.mjs
// Crea andres@myhouse.test (admin) y camila@myhouse.test (editora), contraseña Clave-de-prueba-123, y llena
// 12 meses de movimientos, pagos fijos, deudas, metas, presupuesto, recordatorios y el asistente.
// Es idempotente: borra el hogar y los usuarios de demostración anteriores. No toca otros hogares.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fechaOcurrencia, primeraDesde } from "../src/lib/recurrentes/index.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error("Solo para Supabase local");
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CLAVE = "Clave-de-prueba-123";
const CORREOS = { andres: "andres@myhouse.test", camila: "camila@myhouse.test" };

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const ok = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data;
};

// Números pseudoaleatorios reproducibles (los mismos datos en cada corrida).
let semilla = 20261105;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const entre = (a, b) => Math.round((a + azar() * (b - a)) / 100) * 100;

// ── 1. Limpiar la demostración anterior ───────────────────────────────────────
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
const viejos = lista.users.filter((u) => Object.values(CORREOS).includes(u.email));
if (viejos.length) {
  const { data: miembros } = await admin.from("members").select("household_id").in("user_id", viejos.map((u) => u.id));
  const hogares = [...new Set((miembros ?? []).map((m) => m.household_id))];
  if (hogares.length) ok(await admin.from("households").delete().in("id", hogares), "borrar hogar");
  for (const u of viejos) await admin.auth.admin.deleteUser(u.id);
}

// ── 2. Usuarios y hogar ───────────────────────────────────────────────────────
async function usuario(email, nombre) {
  ok(await admin.auth.admin.createUser({ email, password: CLAVE, email_confirm: true, user_metadata: { nombre } }), "crear usuario");
  const db = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  ok(await db.auth.signInWithPassword({ email, password: CLAVE }), "ingresar");
  return db;
}
const andres = await usuario(CORREOS.andres, "Andrés");
const camila = await usuario(CORREOS.camila, "Camila");

const H = ok(await andres.rpc("crear_hogar", { p_nombre: "Hogar Martínez Rojas", p_nombre_miembro: "Andrés Martínez" }), "crear hogar");
ok(await andres.from("households").update({ ciudad: "Bogotá" }).eq("id", H), "ciudad");
const inv = ok(await andres.from("invitations").insert({ household_id: H, email: CORREOS.camila, rol: "editor" }).select("token").single(), "invitar");
ok(await camila.rpc("aceptar_invitacion", { p_token: inv.token, p_nombre: "Camila Rojas" }), "aceptar");
ok(await andres.from("invitations").insert({ household_id: H, email: "contador@myhouse.test", rol: "contador" }), "invitar contador");
ok(await andres.from("members").insert({ household_id: H, nombre: "Mateo", es_dependiente: true }), "dependiente");
const miembros = ok(await andres.from("members").select("id, nombre"), "miembros");
const M = Object.fromEntries(miembros.map((m) => [m.nombre.split(" ")[0], m.id]));
const db = andres;

// ── 3. Categorías: raíces sembradas + subcategorías del diseño ────────────────
const raices = ok(await db.from("categories").select("id, nombre, clase"), "categorías");
const C = Object.fromEntries(raices.map((c) => [c.nombre, c.id]));
const subcats = [
  ["Arriendo", "Vivienda", "fijo", true],
  ["Administración", "Vivienda", "fijo", true],
  ["Energía", "Servicios públicos", "fijo", true],
  ["Acueducto", "Servicios públicos", "fijo", true],
  ["Gas natural", "Servicios públicos", "fijo", true],
  ["Internet y celular", "Servicios públicos", "fijo", true],
  ["Restaurantes y salidas", "Entretenimiento", "variable", false],
  ["Streaming", "Entretenimiento", "fijo", false],
  ["Hogar y aseo", "Mercado", "variable", true],
  ["Gasolina", "Transporte", "variable", true],
  ["Medicina prepagada", "Salud", "fijo", true],
];
for (const [nombre, padre, tipo, es_esencial] of subcats) {
  const r = ok(
    await db.from("categories").insert({ household_id: H, nombre, padre_id: C[padre], clase: "gasto", tipo, es_esencial }).select("id").single(),
    `subcategoría ${nombre}`,
  );
  C[nombre] = r.id;
}
const etiquetas = ok(await db.from("tax_tags").select("id, codigo").eq("pais", "CO"), "etiquetas");
const T = Object.fromEntries(etiquetas.map((t) => [t.codigo, t.id]));

// ── 4. Cuentas ────────────────────────────────────────────────────────────────
const cuenta = async (c) => ok(await db.from("accounts").insert({ household_id: H, ...c }).select("id").single(), c.nombre).id;
const A = {
  banco: await cuenta({ nombre: "Bancolombia Ahorros", tipo: "banco", entidad: "Bancolombia", ultimos4: "4821", saldo_inicial: 2_400_000, titular_member_id: M.Andrés }),
  davivienda: await cuenta({ nombre: "Davivienda Ahorros", tipo: "banco", entidad: "Davivienda", ultimos4: "0377", saldo_inicial: 1_100_000, titular_member_id: M.Camila }),
  nequi: await cuenta({ nombre: "Nequi", tipo: "billetera", entidad: "Nequi", ultimos4: "4512", saldo_inicial: 150_000, titular_member_id: M.Andrés }),
  visa: await cuenta({ nombre: "Visa Bancolombia", tipo: "tarjeta", entidad: "Bancolombia", ultimos4: "9930", cupo: 8_000_000, dia_corte: 5, dia_pago: 20, saldo_inicial: -1_200_000, titular_member_id: M.Andrés }),
  efectivo: await cuenta({ nombre: "Efectivo", tipo: "efectivo", saldo_inicial: 180_000 }),
};

// ── 5. Deudas ─────────────────────────────────────────────────────────────────
const deuda = async (d) => ok(await db.from("debts").insert({ household_id: H, ...d }).select("id").single(), d.nombre).id;
const D = {
  siste: await deuda({ nombre: "Sistecredito", detalle: "Muebles de la sala", monto: 3_522_000, pagado_inicial: 0, cuota: 587_000, cuotas_total: 6, dia_pago: 3, fecha_limite: "2027-01-03", member_id: M.Andrés }),
  visa: await deuda({ nombre: "Tarjeta Visa Bancolombia", detalle: "Nevera, a 12 cuotas", monto: 6_240_000, pagado_inicial: 520_000 * 2, cuota: 520_000, cuotas_total: 12, dia_pago: 20, fecha_limite: "2027-03-20", member_id: M.Andrés }),
  familia: await deuda({ nombre: "Préstamo familiar", detalle: "Mamá de Camila", monto: 4_000_000, pagado_inicial: 1_000_000, fecha_limite: "2027-06-30", member_id: M.Camila }),
};

// ── 6. Metas de ahorro ────────────────────────────────────────────────────────
const meta = async (m) => ok(await db.from("budgets_goals").insert({ household_id: H, tipo: "meta", periodo: "unico", ...m }).select("id").single(), m.nombre).id;
const G = {
  emergencia: await meta({ nombre: "Fondo de emergencia", monto: 29_000_000, ahorrado_inicial: 16_000_000, aporte_mensual: 900_000, fecha_objetivo: "2027-06-30", icono: "ahorro", es_emergencia: true }),
  viaje: await meta({ nombre: "Viaje a Cartagena", monto: 6_800_000, ahorrado_inicial: 950_000, aporte_mensual: 500_000, fecha_objetivo: "2027-07-31", icono: "meta" }),
  apartamento: await meta({ nombre: "Cuota inicial del apartamento", monto: 60_000_000, ahorrado_inicial: 11_000_000, aporte_mensual: 700_000, fecha_objetivo: "2031-12-31", icono: "arriendo" }),
  matricula: await meta({ nombre: "Matrícula del colegio 2027", monto: 3_200_000, ahorrado_inicial: 0, aporte_mensual: 400_000, fecha_objetivo: "2027-01-15", icono: "educacion" }),
};

// ── 7. Presupuesto adicional por categoría (sobre los pagos fijos) ────────────
const presupuesto = { Vivienda: 150_000, Mercado: 400_000, "Educación de los hijos": 200_000, Transporte: 250_000, Salud: 120_000, Entretenimiento: 450_000, Mascotas: 180_000, Ropa: 200_000 };
ok(
  await db.from("budgets_goals").insert(Object.entries(presupuesto).map(([cat, monto]) => ({ household_id: H, tipo: "presupuesto", periodo: "mensual", category_id: C[cat], monto }))),
  "presupuesto",
);

// ── 8. Pagos fijos (reglas) e historial desde diciembre de 2025 ───────────────
const INICIO = "2025-12";
const fijos = [
  { descripcion: "Salario Andrés", monto: 7_950_000, tipo: "ingreso", cat: "Salario", cuenta: "banco", dia: 30, member: "Andrés", tag: "rentas_trabajo" },
  { descripcion: "Salario Camila", monto: 3_900_000, tipo: "ingreso", cat: "Salario", cuenta: "davivienda", dia: 1, member: "Camila", tag: "rentas_trabajo" },
  { descripcion: "Jardín infantil", monto: 1_340_000, cat: "Educación de los hijos", cuenta: "davivienda", dia: 1, tag: "dependientes" },
  { descripcion: "Streaming", monto: 44_900, cat: "Streaming", cuenta: "visa", dia: 1 },
  { descripcion: "Internet y TV", monto: 159_900, cat: "Internet y celular", cuenta: "banco", dia: 2 },
  { descripcion: "Planes de celular", monto: 118_000, cat: "Internet y celular", cuenta: "nequi", dia: 2 },
  { descripcion: "Energía", monto: 221_680, cat: "Energía", cuenta: "banco", dia: 3 },
  { descripcion: "Sistecredito", monto: 587_000, cat: "Deudas", cuenta: "banco", dia: 3, deuda: "siste", desde: "2026-08" },
  { descripcion: "Arriendo", monto: 1_470_000, cat: "Arriendo", cuenta: "banco", dia: 5 },
  { descripcion: "Administración", monto: 385_000, cat: "Administración", cuenta: "banco", dia: 5 },
  { descripcion: "Acueducto", monto: 148_920, cat: "Acueducto", cuenta: "banco", dia: 10 },
  { descripcion: "Gas natural", monto: 46_300, cat: "Gas natural", cuenta: "banco", dia: 12 },
  { descripcion: "Medicina prepagada", monto: 412_000, cat: "Medicina prepagada", cuenta: "banco", dia: 15, tag: "medicina_prepagada" },
  { descripcion: "Tarjeta Visa · cuota nevera", monto: 520_000, cat: "Deudas", cuenta: "banco", dia: 20, deuda: "visa", desde: "2026-04" },
  { descripcion: "Seguro del carro", monto: 359_875, cat: "Seguros", cuenta: "banco", dia: 25 },
  { descripcion: "Fondo de emergencia", monto: 900_000, cat: "Ahorro e inversión", cuenta: "banco", dia: 6, meta: "emergencia" },
  { descripcion: "Ahorro viaje Cartagena", monto: 500_000, cat: "Ahorro e inversión", cuenta: "davivienda", dia: 6, meta: "viaje", desde: "2026-03" },
  { descripcion: "Ahorro cuota inicial", monto: 700_000, cat: "Ahorro e inversión", cuenta: "banco", dia: 6, meta: "apartamento" },
  { descripcion: "Ahorro matrícula", monto: 400_000, cat: "Ahorro e inversión", cuenta: "davivienda", dia: 6, meta: "matricula", desde: "2026-06" },
];
const movimientos = [];
for (const f of fijos) {
  const desde = f.desde ?? INICIO;
  const inicio = `${desde}-${String(f.dia).padStart(2, "0")}`;
  const { ocurrencias, fecha } = primeraDesde(inicio, "mensual", hoy);
  const regla = ok(
    await db
      .from("recurring_rules")
      .insert({
        household_id: H, descripcion: f.descripcion, monto: f.monto, tipo: f.tipo ?? "gasto", account_id: A[f.cuenta], category_id: C[f.cat],
        member_id: f.member ? M[f.member] : null, frecuencia: "mensual", fecha_inicio: inicio, proxima_fecha: fecha, ocurrencias,
      })
      .select("id")
      .single(),
    `regla ${f.descripcion}`,
  ).id;
  for (let n = 0; n < ocurrencias; n++) {
    const f2 = fechaOcurrencia(inicio, "mensual", n);
    // La cuota de Sistecredito de este mes quedó sin pagar: aparece vencida.
    const vencida = f.deuda === "siste" && f2.slice(0, 7) === hoy.slice(0, 7);
    movimientos.push({
      household_id: H, account_id: A[f.cuenta], fecha: f2, monto: f.monto, tipo: f.tipo ?? "gasto", category_id: C[f.cat], comercio: f.descripcion,
      member_id: f.member ? M[f.member] : null, estado: vencida ? "programado" : "confirmado", origen: "recurrente", recurring_rule_id: regla,
      tax_tag_id: f.tag ? T[f.tag] : null, debt_id: f.deuda ? D[f.deuda] : null, goal_id: f.meta ? G[f.meta] : null,
    });
  }
}

// ── 9. Gastos variables, honorarios y abonos ──────────────────────────────────
const comercios = [
  ["Mercado", ["Éxito Calle 80", "Carulla", "D1", "Ara", "Jumbo"], 4, 60_000, 320_000, "visa"],
  ["Hogar y aseo", ["Homecenter", "Tiendas D1 aseo"], 1, 40_000, 160_000, "visa"],
  ["Restaurantes y salidas", ["Crepes & Waffles", "El Corral", "Domicilio Rappi", "Cine Colombia"], 3, 35_000, 160_000, "nequi"],
  ["Gasolina", ["Terpel", "Primax"], 2, 120_000, 220_000, "visa"],
  ["Salud", ["Droguería Alemana", "Cruz Verde"], 1, 25_000, 120_000, "nequi"],
  ["Mascotas", ["Veterinaria Patitas", "Puppis"], 1, 60_000, 140_000, "nequi"],
  ["Ropa", ["Falabella", "Arturo Calle"], 0.5, 90_000, 380_000, "visa"],
];
const ultimoDia = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(2025, 11 + i, 1));
  const mes = d.toISOString().slice(0, 7);
  for (const [cat, nombres, porMes, min, max, cta] of comercios) {
    const veces = Math.max(0, Math.round(porMes + (azar() - 0.5) * 2));
    for (let k = 0; k < veces; k++) {
      const fecha = `${mes}-${String(1 + Math.floor(azar() * ultimoDia(mes))).padStart(2, "0")}`;
      if (fecha >= hoy) continue;
      movimientos.push({
        household_id: H, account_id: A[cta], fecha, monto: entre(min, max), tipo: "gasto", category_id: C[cat],
        comercio: nombres[Math.floor(azar() * nombres.length)], member_id: azar() < 0.5 ? M.Andrés : M.Camila, origen: "manual",
        tax_tag_id: cat === "Mercado" && azar() < 0.3 ? T.factura_electronica : null,
      });
    }
  }
  // Honorarios de Andrés (negocio) cada dos meses y un almuerzo de negocio.
  if (i % 2 === 0 && `${mes}-15` < hoy) {
    movimientos.push({ household_id: H, account_id: A.davivienda, fecha: `${mes}-15`, monto: 700_000 + entre(0, 900_000), tipo: "ingreso", category_id: C.Honorarios, comercio: "Honorarios diseño web", member_id: M.Andrés, ambito: "negocio", tax_tag_id: T.honorarios });
    movimientos.push({ household_id: H, account_id: A.nequi, fecha: `${mes}-16`, monto: entre(90_000, 180_000), tipo: "gasto", category_id: C["Restaurantes y salidas"], comercio: "Almuerzo con cliente", member_id: M.Andrés, ambito: "negocio" });
  }
  // Abono al préstamo familiar cada tres meses.
  if (i % 3 === 1 && `${mes}-28` < hoy) {
    movimientos.push({ household_id: H, account_id: A.davivienda, fecha: `${mes}-28`, monto: 250_000, tipo: "gasto", category_id: C.Deudas, comercio: "Abono préstamo familiar", member_id: M.Camila, debt_id: D.familia });
  }
}
// Pago de la tarjeta (transferencia banco → tarjeta) el 20, por lo gastado con ella el mes anterior, y recarga
// de Nequi el día 1 por lo que se gastó desde Nequi ese mes.
const gastoDe = (cuenta, mes) => movimientos.filter((m) => m.account_id === A[cuenta] && m.tipo === "gasto" && m.fecha.startsWith(mes)).reduce((s, m) => s + m.monto, 0);
for (let i = 0; i < 12; i++) {
  const mes = new Date(Date.UTC(2025, 11 + i, 1)).toISOString().slice(0, 7);
  const anterior = new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 7);
  const pagoTarjeta = gastoDe("visa", anterior);
  if (pagoTarjeta && `${mes}-20` < hoy) movimientos.push({ household_id: H, account_id: A.banco, cuenta_destino_id: A.visa, fecha: `${mes}-20`, monto: pagoTarjeta, tipo: "transferencia", comercio: "Pago tarjeta Visa" });
  const recarga = gastoDe("nequi", mes);
  if (recarga && `${mes}-01` < hoy) movimientos.push({ household_id: H, account_id: A.banco, cuenta_destino_id: A.nequi, fecha: `${mes}-01`, monto: recarga, tipo: "transferencia", comercio: "Recarga Nequi" });
}
// En un insert de varias filas PostgREST toma la unión de columnas: lo que falte en una fila iría como null.
const BASE = { estado: "confirmado", origen: "manual", ambito: "personal", member_id: null, category_id: null, cuenta_destino_id: null, tax_tag_id: null, recurring_rule_id: null, debt_id: null, goal_id: null };
const filas = movimientos.map((m) => ({ ...BASE, ...m }));
for (let i = 0; i < filas.length; i += 200) ok(await db.from("transactions").insert(filas.slice(i, i + 200)), "movimientos");
ok(await db.rpc("generar_recurrentes_hogar", { p_household: H }), "programar próximos 7 días");

// ── 10. Recordatorios, reglas del asistente y una conversación de ejemplo ─────
ok(
  await db.from("reminders").insert([
    { household_id: H, nombre: "SOAT del carro", fecha: "2027-02-14", repetir: "anual", avisos: [14], canales: ["whatsapp"] },
    { household_id: H, nombre: "Matrícula del colegio", fecha: "2027-01-15", monto: 3_200_000, repetir: "anual", avisos: [7], canales: ["whatsapp", "correo"] },
    { household_id: H, nombre: "Seguro del hogar", fecha: "2027-03-10", monto: 480_000, repetir: "anual", avisos: [0, 7], canales: ["notificacion", "whatsapp"] },
    { household_id: H, nombre: "Declaración de renta · Andrés", fecha: "2027-08-12", repetir: "anual", avisos: [30], canales: ["correo"] },
    { household_id: H, nombre: "Impuesto predial", fecha: "2027-04-17", monto: 620_000, repetir: "anual", avisos: [7], canales: ["notificacion"], activo: false },
  ].map((r) => ({ monto: null, activo: true, ...r }))),
  "recordatorios",
);
ok(
  await db.from("merchant_rules").insert([
    { household_id: H, patron: "exito", category_id: C.Mercado },
    { household_id: H, patron: "enel", category_id: C.Energía },
    { household_id: H, patron: "terpel", category_id: C.Gasolina },
    { household_id: H, patron: "veterinaria patitas", category_id: C.Mascotas, ambito: "personal" },
  ].map((r) => ({ ambito: null, ...r }))),
  "reglas de comercio",
);
const recibo = ok(
  await camila
    .from("receipts")
    .insert({
      household_id: H, nombre_archivo: "factura_exito.jpg", mime: "image/jpeg", estado: "registrado",
      datos: { comercio: "Éxito Calle 80", fecha: hoy, total: 286_400, tipo: "gasto", categoria: "Mercado", confianza: 98, cuenta: "Visa Bancolombia" },
    })
    .select("id")
    .single(),
  "comprobante",
);
ok(
  await camila.from("assistant_messages").insert([
    { household_id: H, autor: "usuario", texto: "Te mando la factura del mercado de hoy", receipt_ids: [recibo.id] },
    { household_id: H, autor: "asistente", texto: "Leí la factura de Éxito Calle 80 por $ 286.400 y la registré en Mercado, con la Visa Bancolombia.", receipt_ids: [recibo.id] },
  ]),
  "mensajes",
);

console.log(`Hogar de demostración listo: ${movimientos.length} movimientos.`);
console.log(`Ingrese con ${CORREOS.andres} o ${CORREOS.camila} · contraseña ${CLAVE}`);
