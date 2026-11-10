/**
 * Aislamiento multi-tenant contra Supabase local.
 * Hogar A: Ana (admin), Beto (editor, por invitación), Dora (contador, por invitación).
 * Hogar B: Carla (admin). Carla no debe ver ni tocar nada del hogar A.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const sufijo = Math.random().toString(36).slice(2, 8);
const clave = "Clave-de-prueba-123";
const userIds: string[] = [];
const hogares: string[] = [];

async function usuario(nombre: string): Promise<{ email: string; db: SupabaseClient }> {
  const email = `${nombre}-${sufijo}@prueba.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: e2 } = await db.auth.signInWithPassword({ email, password: clave });
  if (e2) throw e2;
  return { email, db };
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

async function invitar(db: SupabaseClient, household_id: string, email: string, rol: string) {
  const { data, error } = await db.from("invitations").insert({ household_id, email, rol }).select("token").single();
  if (error) throw error;
  return data.token as string;
}

let ana: SupabaseClient, beto: SupabaseClient, carla: SupabaseClient, dora: SupabaseClient;
let betoEmail: string;
let hogarA: string, hogarB: string;
let cuentaA: string, cuentaB: string, categoriaA: string, categoriaB: string, movimientoA: string;

beforeAll(async () => {
  if (!url || !anonKey || !serviceKey) throw new Error("Faltan variables en .env.local (ver .env.example)");

  const a = await usuario("ana");
  const b = await usuario("beto");
  const c = await usuario("carla");
  const d = await usuario("dora");
  ana = a.db; beto = b.db; carla = c.db; dora = d.db; betoEmail = b.email;

  hogarA = await rpc<string>(ana, "crear_hogar", { p_nombre: "Hogar A", p_nombre_miembro: "Ana" });
  hogarB = await rpc<string>(carla, "crear_hogar", { p_nombre: "Hogar B", p_nombre_miembro: "Carla" });
  hogares.push(hogarA, hogarB);
  // Estas pruebas son de aislamiento, no de límites: el hogar A (con 3 personas) va en Familia.
  const plan = await admin.from("households").update({ plan: "familia" }).eq("id", hogarA);
  if (plan.error) throw plan.error;

  await rpc(beto, "aceptar_invitacion", { p_token: await invitar(ana, hogarA, b.email, "editor"), p_nombre: "Beto" });
  await rpc(dora, "aceptar_invitacion", { p_token: await invitar(ana, hogarA, d.email, "contador"), p_nombre: "Dora" });

  const ca = await ana.from("accounts").insert({ household_id: hogarA, tipo: "banco", nombre: "Banco A" }).select("id").single();
  const cb = await carla.from("accounts").insert({ household_id: hogarB, tipo: "banco", nombre: "Banco B" }).select("id").single();
  cuentaA = ca.data!.id; cuentaB = cb.data!.id;

  categoriaA = (await ana.from("categories").select("id").eq("nombre", "Mercado").single()).data!.id;
  categoriaB = (await carla.from("categories").select("id").eq("nombre", "Mercado").single()).data!.id;

  const m = await ana.from("transactions").insert({
    household_id: hogarA, account_id: cuentaA, fecha: "2026-11-01", monto: 150000, tipo: "gasto", category_id: categoriaA,
  }).select("id").single();
  if (m.error) throw m.error;
  movimientoA = m.data.id;

  // Una fila de cada módulo nuevo en el hogar A, para comprobar que Carla no la ve.
  for (const [tabla, fila] of [
    ["debts", { nombre: "Deuda A", monto: 1000 }],
    ["reminders", { nombre: "Recordatorio A", fecha: "2026-12-01" }],
    ["receipts", { nombre_archivo: "a.jpg", mime: "image/jpeg" }],
    ["assistant_messages", { autor: "usuario", texto: "hola" }],
    ["merchant_rules", { patron: "exito", category_id: categoriaA }],
    ["budgets_goals", { tipo: "meta", nombre: "Meta A", monto: 1000, periodo: "unico" }],
  ] as const) {
    const { error } = await ana.from(tabla).insert({ household_id: hogarA, ...fila });
    if (error) throw new Error(`${tabla}: ${error.message}`);
  }
});

afterAll(async () => {
  if (hogares.length) await admin.from("households").delete().in("id", hogares);
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
});

describe("mismo hogar", () => {
  it("dos usuarios del hogar ven los mismos movimientos", async () => {
    const nuevo = await beto.from("transactions").insert({
      household_id: hogarA, account_id: cuentaA, fecha: "2026-11-02", monto: 80000, tipo: "gasto", category_id: categoriaA,
    }).select("id").single();
    expect(nuevo.error).toBeNull();

    const deAna = await ana.from("transactions").select("id").order("fecha");
    const deBeto = await beto.from("transactions").select("id").order("fecha");
    expect(deAna.data!.map((t) => t.id)).toEqual(deBeto.data!.map((t) => t.id));
    expect(deAna.data!.length).toBeGreaterThanOrEqual(2);
  });

  it("el contador lee pero no escribe", async () => {
    const lee = await dora.from("transactions").select("id");
    expect(lee.data!.length).toBeGreaterThan(0);

    const escribe = await dora.from("transactions").insert({
      household_id: hogarA, account_id: cuentaA, fecha: "2026-11-03", monto: 1000, tipo: "gasto", category_id: categoriaA,
    });
    expect(escribe.error).not.toBeNull();
  });

  it("el hogar recibió las categorías semilla", async () => {
    const { data } = await ana.from("categories").select("nombre").eq("clase", "gasto");
    expect(data!.map((c) => c.nombre)).toContain("Educación de los hijos");
    expect(data).toHaveLength(13);
  });
});

describe("autoría", () => {
  it("un usuario no puede registrar movimientos a nombre de otro", async () => {
    const { data: yo } = await beto.auth.getUser();
    const { data: ana_ } = await ana.auth.getUser();
    const { data, error } = await beto
      .from("transactions")
      .insert({
        household_id: hogarA, account_id: cuentaA, fecha: "2026-11-05", monto: 1000, tipo: "gasto", category_id: categoriaA,
        created_by: ana_.user!.id,
      })
      .select("created_by")
      .single();
    expect(error).toBeNull();
    expect(data!.created_by).toBe(yo.user!.id);
  });
});

describe("otro hogar no ve nada", () => {
  it.each(["households", "members", "accounts", "categories", "transactions", "invitations", "account_balances", "budgets_goals", "debts", "reminders", "receipts", "assistant_messages", "merchant_rules"])(
    "%s del hogar A es invisible para Carla",
    async (tabla) => {
      const columna = tabla === "households" ? "id" : "household_id";
      const { data, error } = await carla.from(tabla).select("*").eq(columna, hogarA);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("no puede insertar en el hogar A", async () => {
    const { error } = await carla.from("transactions").insert({
      household_id: hogarA, account_id: cuentaA, fecha: "2026-11-01", monto: 1, tipo: "gasto", category_id: categoriaA,
    });
    expect(error).not.toBeNull();
  });

  it("no puede referenciar la cuenta ni la categoría del hogar A desde el suyo", async () => {
    const conCuentaAjena = await carla.from("transactions").insert({
      household_id: hogarB, account_id: cuentaA, fecha: "2026-11-01", monto: 1, tipo: "gasto", category_id: categoriaB,
    });
    expect(conCuentaAjena.error).not.toBeNull();

    const conCategoriaAjena = await carla.from("transactions").insert({
      household_id: hogarB, account_id: cuentaB, fecha: "2026-11-01", monto: 1, tipo: "gasto", category_id: categoriaA,
    });
    expect(conCategoriaAjena.error).not.toBeNull();
  });

  it("no puede modificar ni borrar movimientos del hogar A", async () => {
    await carla.from("transactions").update({ monto: 1 }).eq("id", movimientoA);
    await carla.from("transactions").delete().eq("id", movimientoA);
    const { data } = await ana.from("transactions").select("monto").eq("id", movimientoA).single();
    expect(data!.monto).toBe(150000);
  });

  it("no puede mover su fila al hogar A", async () => {
    const { error } = await carla.from("accounts").update({ household_id: hogarA }).eq("id", cuentaB);
    expect(error).not.toBeNull();
  });

  it("los reportes del hogar A le salen vacíos", async () => {
    const totales = await carla.rpc("totales_por_categoria", { p_household: hogarA, p_desde: "2026-01-01", p_hasta: "2026-12-31" });
    expect(totales.data).toEqual([]);
    const acumulados = await carla.rpc("acumulados_tributarios", { p_household: hogarA, p_anio: 2026 });
    expect(acumulados.data).toEqual([]);
  });

  it("no puede generar recurrentes del hogar A", async () => {
    const { error } = await carla.rpc("generar_recurrentes_hogar", { p_household: hogarA });
    expect(error).not.toBeNull();
  });

  it("no puede usar una invitación dirigida a otro correo", async () => {
    const token = await invitar(ana, hogarA, `otra-${betoEmail}`, "editor");
    const { error } = await carla.rpc("aceptar_invitacion", { p_token: token, p_nombre: "Intrusa" });
    expect(error).not.toBeNull();
    const { data } = await ana.from("members").select("nombre").eq("household_id", hogarA);
    expect(data!.map((m) => m.nombre)).not.toContain("Intrusa");
  });

  it("no puede subir ni leer soportes del hogar A", async () => {
    const ruta = `${hogarA}/${movimientoA}/factura.pdf`;
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const subidaAna = await ana.storage.from("soportes").upload(ruta, pdf);
    expect(subidaAna.error).toBeNull();

    const subida = await carla.storage.from("soportes").upload(`${hogarA}/${movimientoA}/intrusa.pdf`, pdf);
    expect(subida.error).not.toBeNull();
    const lectura = await carla.storage.from("soportes").download(ruta);
    expect(lectura.error).not.toBeNull();

    await ana.storage.from("soportes").remove([ruta]);
  });
});

describe("personas a cargo y configuración del hogar", () => {
  it("el admin agrega una persona a cargo con parentesco, edad y quién la tiene a cargo", async () => {
    const { data: anaMiembro } = await ana.from("members").select("id").eq("household_id", hogarA).eq("nombre", "Ana").single();
    const { data, error } = await ana
      .from("members")
      .insert({ household_id: hogarA, nombre: "Sofía", es_dependiente: true, parentesco: "hijo", fecha_nacimiento: "2017-03-10", a_cargo_de: anaMiembro!.id, dependiente_dian: true })
      .select("id, a_cargo_de")
      .single();
    expect(error).toBeNull();
    expect(data!.a_cargo_de).toBe(anaMiembro!.id);
    // Lo ve todo el hogar (el contador también); el otro hogar no.
    expect((await dora.from("members").select("id").eq("id", data!.id)).data).toHaveLength(1);
    expect((await carla.from("members").select("id").eq("id", data!.id)).data).toHaveLength(0);
  });

  it("no se puede poner a cargo de alguien de otro hogar ni con un parentesco inventado", async () => {
    const { data: carlaMiembro } = await carla.from("members").select("id").eq("household_id", hogarB).single();
    const ajeno = await ana.from("members").insert({ household_id: hogarA, nombre: "X", es_dependiente: true, a_cargo_de: carlaMiembro!.id });
    expect(ajeno.error).not.toBeNull();
    const inventado = await ana.from("members").insert({ household_id: hogarA, nombre: "Y", es_dependiente: true, parentesco: "vecino" });
    expect(inventado.error).not.toBeNull();
  });

  it("un editor no puede editar personas ni la configuración (IA, contexto) del hogar", async () => {
    const { data: sofia } = await ana.from("members").select("id").eq("household_id", hogarA).eq("nombre", "Sofía").single();
    const { data: cambiada } = await beto.from("members").update({ nota: "editada por Beto" }).eq("id", sofia!.id).select("id");
    expect(cambiada).toHaveLength(0);
    const { data: config } = await beto
      .from("households")
      .update({ config: { ia: { proveedor: "openai", modelo: "gpt-4.1" } } })
      .eq("id", hogarA)
      .select("id");
    expect(config).toHaveLength(0);
    const { data } = await ana.from("households").select("config").eq("id", hogarA).single();
    expect((data!.config as { ia?: unknown }).ia).toBeUndefined();
  });

  it("los parámetros de la deducción por dependientes se leen en UVT", async () => {
    const { data } = await ana.from("tax_params").select("deducciones").eq("pais", "CO").eq("anio", 2026).single();
    expect(data!.deducciones).toMatchObject({ dependientes_pct: 10, dependientes_tope_anual: 384, dependiente_adicional: 72, dependientes_max: 4 });
  });
});

describe("avisos por correo", () => {
  it("avisos_enviados solo la usa el servidor: ni el admin del hogar la lee ni la escribe", async () => {
    await admin.from("avisos_enviados").insert({ household_id: hogarA, clave: `prueba:${sufijo}`, tipo: "prueba" });
    const { data: leidos } = await ana.from("avisos_enviados").select("clave").eq("household_id", hogarA);
    expect(leidos ?? []).toEqual([]); // sin permisos directos: error o vacío
    const escrito = await ana.from("avisos_enviados").insert({ household_id: hogarA, clave: `falsa:${sufijo}`, tipo: "prueba" });
    expect(escrito.error).not.toBeNull();
    const { data: borrados } = await ana.from("avisos_enviados").delete().eq("household_id", hogarA).select("clave");
    expect(borrados ?? []).toEqual([]);
    const { data: siguen } = await admin.from("avisos_enviados").select("clave").eq("household_id", hogarA);
    expect(siguen).toEqual([{ clave: `prueba:${sufijo}` }]);
  });
});
