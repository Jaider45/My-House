import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Aviso, Barra, Chip, CuadroIcono, EnlaceBoton, FilaLista, Kpi, SelectorMes, Tarjeta, Titulo, Vacio, cx } from "@/components/ui";
import { Icono } from "@/components/marca";
import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { Ventana } from "@/components/ui/ventana";
import { EditorPanel } from "./panel/editor";
import { datosNecesarios, leerPanel, type IdIndicador, type IdSeccion } from "@/lib/panel";
import { avanceDeuda } from "@/lib/deudas";
import { avanceMeta } from "@/lib/metas";
import { formatearCOP, formatearCorto, porcentaje } from "@/lib/dinero";
import { formatearDia, formatearMes, hoy, mesDe, rangoMes, sumarDias, sumarMeses } from "@/lib/fechas";
import { resumirMes, type TotalCategoria } from "@/lib/finanzas";
import type { Categoria } from "@/lib/categorias";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { cargarSemaforo, type SemaforoAnio } from "@/lib/impuestos/servidor";
import { cargarPlan } from "@/lib/presupuesto/servidor";
import { entradasPorCategoria, filasPresupuesto } from "@/lib/presupuesto";
import type { NombreIcono } from "@/components/marca";
import { fechasEnRango } from "@/lib/recurrentes";
import { BotonGuia } from "@/components/guia/boton-guia";

export default function Inicio({ searchParams }: PageProps<"/">) {
  return (
    <Tablero searchParams={searchParams} />
  );
}

const veces = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nombreMes = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });
const etiquetaMesCorto = (mes: string) => {
  const t = nombreMes.format(new Date(`${mes}-01T00:00:00Z`)).replace(".", "");
  return t.charAt(0).toUpperCase() + t.slice(1, 3);
};

async function Tablero({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const sp = await searchParams;
  const hoyISO = hoy();
  const mesActual = mesDe(hoyISO);
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual;
  const { desde, hasta } = rangoMes(mes);

  const anio = Number(mesActual.slice(0, 4));
  // Lo que esta persona eligió ver en su Inicio (user_metadata.panel): solo se pide a la base lo que se muestra.
  const panel = leerPanel((await obtenerUsuario()).user.user_metadata);
  const pide = datosNecesarios(panel);
  const [{ data: filas }, { data: categorias }, { count: personas }, { count: cuentas }, { plan, reglas, presupuestos }, { count: sinCategoria }, { data: programados }, semaforo, extra] =
    await Promise.all([
      ctx.supabase.rpc("totales_por_categoria", { p_household: ctx.hogar.id, p_desde: rangoMes(sumarMeses(mes, -11)).desde, p_hasta: hasta }),
      ctx.supabase.from("categories").select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada"),
      ctx.supabase.from("members").select("id", { count: "exact", head: true }),
      ctx.supabase.from("accounts").select("id", { count: "exact", head: true }),
      cargarPlan(ctx, mes, hoyISO),
      ctx.supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .neq("tipo", "transferencia")
        .is("category_id", null)
        .gte("fecha", desde)
        .lte("fecha", hasta),
      ctx.supabase
        .from("transactions")
        .select("id, fecha, monto, comercio, category_id")
        .eq("tipo", "gasto")
        .eq("estado", "programado")
        .lte("fecha", sumarDias(hoyISO, 15))
        .order("fecha")
        .limit(6),
      pide.semaforo ? cargarSemaforo(ctx, anio) : Promise.resolve(null),
      cargarExtras(ctx, pide, hoyISO),
    ]);

  const todas = (filas ?? []) as TotalCategoria[];
  const cats = (categorias ?? []) as Categoria[];
  // El plan (pagos fijos y presupuesto) solo aplica al mes en curso: los meses cerrados se miden con lo real.
  const conPlan = mes >= mesActual;
  const r = resumirMes({
    mes,
    filas: todas,
    categorias: cats,
    personas: personas ?? 1,
    cuotaImprevistosPct: ctx.hogar.cuotaImprevistosPct,
    plan: conPlan ? plan : undefined,
  });
  const porId = new Map(cats.map((c) => [c.id, c]));
  // Próximos pagos: lo ya programado + lo que las reglas programarán en los próximos 15 días.
  const limite = sumarDias(hoyISO, 15);
  const pendientes = [
    ...(programados ?? []).map((p) => ({ clave: p.id, fecha: p.fecha, monto: p.monto, nombre: p.comercio, category_id: p.category_id })),
    ...reglas
      .filter((g) => g.tipo === "gasto")
      .flatMap((g) =>
        fechasEnRango(g.fecha_inicio, g.frecuencia, g.ocurrencias, hoyISO, limite).map((f) => ({ clave: `${g.id}-${f}`, fecha: f, monto: g.monto, nombre: g.descripcion, category_id: g.category_id })),
      ),
  ]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);
  const titulo = `Resumen de ${formatearMes(mes).replace(/ de \d{4}$/, "")}`;
  const encabezado = (
    <Titulo
      subtitulo="Cuánto cuesta sostener la casa este mes"
      registrar={ctx.puedeEditar}
      accion={
        <>
          <SelectorMes etiqueta={formatearMes(mes).replace(" de ", " ")} anterior={`/?mes=${sumarMeses(mes, -1)}`} siguiente={mes < mesActual ? `/?mes=${sumarMeses(mes, 1)}` : undefined} />
          <EnlaceBoton href={mes === mesActual ? "/?nuevo=panel" : `/?mes=${mes}&nuevo=panel`} variante="secundario" className="h-10 px-3 text-sm" scroll={false}>
            <Icono nombre="configuracion" tamano={18} />
            <span className="hidden sm:inline">Personalizar</span>
          </EnlaceBoton>
          <BotonGuia id="bienvenida" />
        </>
      }
    >
      {titulo}
    </Titulo>
  );

  const editor = (
    <Ventana valor="panel" titulo="Personaliza tu Inicio" subtitulo="Elige qué quieres ver primero" ancho={720}>
      <EditorPanel inicial={panel} />
    </Ventana>
  );

  if (r.ingresos + r.gastos + r.porPagar + r.costoVida === 0) {
    const pasos = [
      { icono: "cuentas", titulo: "Crea tus cuentas", detalle: "Banco, efectivo, tarjetas", hecho: (cuentas ?? 0) > 0, href: "/cuentas" },
      { icono: "calendario", titulo: "Carga tus pagos fijos", detalle: "Arriendo, servicios, colegio, créditos", hecho: reglas.length > 0, href: "/presupuesto" },
      { icono: "egresos", titulo: "Registra tu primer gasto", detalle: "Toma menos de 10 segundos", hecho: false, href: "/rapido" },
      { icono: "familia", titulo: "Invita a tu pareja", detalle: "Registren juntos, vean lo mismo", hecho: (personas ?? 0) > 1, href: "/ajustes/miembros" },
    ] as const;
    return (
      <>
        {encabezado}
        {editor}
        <div className="space-y-4 md:space-y-5">
          <Vacio
            icono="resumen"
            titulo={`Tu resumen de ${formatearMes(mes).replace(/ de \d{4}$/, "")} está vacío`}
            acciones={
              <>
                <EnlaceBoton href={cuentas ? "/rapido" : "/cuentas"}>{cuentas ? "Registrar un gasto" : "Crear una cuenta"}</EnlaceBoton>
                <EnlaceBoton href="/importar" variante="secundario">
                  Importar extracto CSV
                </EnlaceBoton>
                <BotonGuia id="bienvenida" variante="fantasma">
                  Ver cómo funciona
                </BotonGuia>
              </>
            }
          >
            Registra tu primer gasto o importa el extracto del banco. Con tus pagos fijos cargados, My House calcula el número mínimo del hogar.
          </Vacio>
          <Tarjeta>
            <p className="mb-2 text-xs leading-4 font-bold tracking-[0.12em] uppercase">Primeros pasos</p>
            {pasos.map((p) => (
              <Link key={p.titulo} href={p.href} className="block">
                <FilaLista icono={p.icono} titulo={p.titulo} detalle={p.detalle} valor={<Chip tono={p.hecho ? "ok" : "neutro"}>{p.hecho ? "Hecho" : "Pendiente"}</Chip>} />
              </Link>
            ))}
          </Tarjeta>
        </div>
      </>
    );
  }

  const cantidadIngresos = todas.filter((f) => f.mes.startsWith(mes) && f.tipo === "ingreso" && f.estado === "confirmado").reduce((s, f) => s + (f.cantidad ?? 0), 0);
  const vencidos = pendientes.filter((p) => p.fecha < hoyISO).length;
  const nombreDelMes = formatearMes(mes).replace(/ de \d{4}$/, "");

  // Top de categorías contra presupuesto y gasto pronosticado: el mismo cálculo de la pantalla Presupuesto.
  const diasMes = Number(hasta.slice(8));
  const dia = mes < mesActual ? diasMes : Number(hoyISO.slice(8));
  const filasPres = filasPresupuesto(
    entradasPorCategoria({ mes, categorias: cats, reglas: conPlan ? reglas : [], presupuestos: conPlan ? presupuestos : [], totales: todas }),
    dia,
    diasMes,
  );
  const pronosticado = filasPres.reduce((s, f) => s + f.pronostico, 0);
  const top = [...filasPres].filter((f) => f.real > 0).sort((a, b) => b.real - a.real).slice(0, 5);
  const pasada = top.find((c) => c.semaforo === "excedido");
  const academia: { href: string; icono: NombreIcono; etiqueta: string; titulo: string }[] = [
    { href: "/academia/finanzas/numero-minimo", icono: "educacion", etiqueta: "Lección · 3 min", titulo: "¿Qué es el número mínimo del hogar?" },
    { href: "/academia/empieza/registrar", icono: "egresos", etiqueta: "Uso de la app · 2 min", titulo: "Registra un gasto en 10 segundos" },
    pasada
      ? { href: "/academia/finanzas/cuando-te-pasas", icono: iconoCategoria(pasada.nombre), etiqueta: `Porque ${pasada.nombre} se pasó`, titulo: "Qué hacer cuando una categoría se pasa" }
      : { href: "/academia/ahorro/cuanto-fondo", icono: "ahorro", etiqueta: "Lección · 4 min", titulo: "¿Cuánto debe tener tu fondo de emergencia?" },
  ];
  const SEM = {
    en_rango: { tono: "ok", texto: "En rango" },
    atento: { tono: "alerta", texto: "Atento" },
    excedido: { tono: "error", texto: "Excedido" },
  } as const;

  // ── Datos de los indicadores que no salen del resumen del mes ──
  const deudas = extra.deudas;
  const totalDeudas = deudas.reduce((t, d) => ({ pendiente: t.pendiente + d.pendiente, delMes: t.delMes + d.delMes }), { pendiente: 0, delMes: 0 });
  const conPendiente = deudas.filter((d) => d.pendiente > 0);
  const mesesFin = Math.max(0, ...conPendiente.map((d) => d.mesesRestantes ?? 0));
  const metas = extra.metas;
  const totalMetas = metas.reduce((t, m) => ({ ahorrado: t.ahorrado + m.ahorrado, objetivo: t.objetivo + m.monto }), { ahorrado: 0, objetivo: 0 });
  const { disponible, usadoTarjetas, cupoTarjetas } = extra.saldos;
  const mesLargo = (m: string) => mayuscula(formatearMes(m).replace(" de ", " "));
  const cargaDeuda = r.ingresosEsperados ? porcentaje(totalDeudas.delMes, r.ingresosEsperados) : 0;

  const indicadores: Record<IdIndicador, () => ReactNode> = {
    ingresos: () => (
      <Kpi
        icono="ingresos"
        etiqueta="Ingresos del mes"
        valor={formatearCOP(r.ingresos)}
        detalle={
          r.ingresosEsperados > r.ingresos
            ? `De ${formatearCOP(r.ingresosEsperados)} esperados`
            : `${cantidadIngresos} ${cantidadIngresos === 1 ? "ingreso registrado" : "ingresos registrados"}`
        }
      />
    ),
    gastos: () => (
      <Kpi
        icono="egresos"
        etiqueta="Gastos del mes"
        valor={formatearCOP(r.gastos)}
        detalle={pronosticado ? `${porcentaje(r.gastos, pronosticado)} % del gasto pronosticado` : "Sin gasto pronosticado"}
      />
    ),
    pendientes: () => (
      <Kpi
        icono="calendario"
        etiqueta="Pagos fijos pendientes"
        valor={formatearCOP(r.porPagar)}
        detalle={
          r.pagosPorPagar
            ? `${r.pagosPorPagar} ${r.pagosPorPagar === 1 ? "pago" : "pagos"}${vencidos ? ` · ${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}` : ""}`
            : "Todo pagado este mes"
        }
      />
    ),
    ahorro: () => (
      <Kpi
        icono="ahorro"
        etiqueta="Ahorro del mes"
        valor={r.ingresosEsperados ? formatearCOP(r.ahorroProyectado) : "—"}
        detalle={
          !r.ingresosEsperados
            ? conPlan
              ? "Agrega tu salario como ingreso fijo para proyectarlo"
              : "Sin ingresos registrados"
            : r.ahorroProyectado < 0
              ? "El costo de vida supera los ingresos"
              : `${conPlan ? "Proyectado · " : ""}${porcentaje(r.ahorroProyectado, r.ingresosEsperados)} % de los ingresos`
        }
      />
    ),
    numero_minimo: () => (
      <Kpi
        clave
        icono="casa"
        etiqueta="Número mínimo del hogar"
        valor={formatearCOP(r.numeroMinimo.total)}
        detalle={
          r.ingresosEsperados && r.numeroMinimo.total
            ? `Tus ingresos lo cubren ${veces.format(r.ingresosEsperados / r.numeroMinimo.total)} veces`
            : "Lo que la casa necesita sí o sí"
        }
      />
    ),
    pronosticado: () => (
      <Kpi
        icono="resumen"
        etiqueta={conPlan ? "Gasto pronosticado" : "Gasto del mes"}
        valor={formatearCOP(pronosticado)}
        detalle={conPlan ? `Cierre estimado al ${diasMes} de ${nombreDelMes}` : `Costo de vida ${formatearCOP(r.costoVida)}`}
      />
    ),
    costo_vida: () => (
      <Kpi icono="casa" etiqueta="Costo de vida" valor={formatearCOP(r.costoVida)} detalle={`Fijos ${formatearCOP(r.fijos)} · variables ${formatearCOP(r.variables)}`} />
    ),
    costo_persona: () => (
      <Kpi
        icono="familia"
        etiqueta="Costo por persona"
        valor={formatearCOP(r.costoPorPersona)}
        detalle={`${personas ?? 1} ${(personas ?? 1) === 1 ? "persona" : "personas"} en el hogar`}
      />
    ),
    esenciales: () => (
      <Kpi
        icono="mercado"
        etiqueta="Gasto esencial"
        valor={formatearCOP(r.costoEsencial)}
        detalle={r.costoVida ? `${porcentaje(r.costoEsencial, r.costoVida)} % del costo de vida` : "Sin costo de vida aún"}
      />
    ),
    tasa_ahorro: () => (
      <Kpi
        icono="meta"
        etiqueta="Tasa de ahorro"
        valor={r.ingresosEsperados ? `${porcentaje(Math.max(0, r.ahorroProyectado), r.ingresosEsperados)} %` : "—"}
        detalle={
          !r.ingresosEsperados ? "Sin ingresos para calcularla" : r.ahorroProyectado < 0 ? "Este mes se gasta más de lo que entra" : "De los ingresos esperados del mes"
        }
      />
    ),
    metas_ahorrado: () => (
      <Kpi
        icono="meta"
        etiqueta="Ahorrado en metas"
        valor={formatearCOP(totalMetas.ahorrado)}
        detalle={metas.length ? `${porcentaje(totalMetas.ahorrado, totalMetas.objetivo)} % de ${formatearCOP(totalMetas.objetivo)}` : "Aún no hay metas"}
      />
    ),
    meses_cubiertos: () => (
      <Kpi
        icono="ahorro"
        etiqueta="Meses cubiertos"
        valor={r.numeroMinimo.total ? `${veces.format(Math.max(0, disponible) / r.numeroMinimo.total)} meses` : "—"}
        detalle={r.numeroMinimo.total ? "Plata disponible frente al número mínimo" : "Carga tus pagos fijos para calcularlo"}
      />
    ),
    disponible: () => <Kpi icono="cuentas" etiqueta="Plata disponible" valor={formatearCOP(disponible)} detalle="Bancos, efectivo y billeteras" />,
    tarjetas_usado: () => (
      <Kpi
        icono="cuentas"
        etiqueta="Tarjetas usadas"
        valor={formatearCOP(usadoTarjetas)}
        detalle={cupoTarjetas ? `${porcentaje(usadoTarjetas, cupoTarjetas)} % de ${formatearCOP(cupoTarjetas)} de cupo` : "Sin tarjetas con cupo"}
      />
    ),
    deuda_pendiente: () => (
      <Kpi
        icono="deducciones"
        etiqueta="Deuda pendiente"
        valor={formatearCOP(totalDeudas.pendiente)}
        detalle={conPendiente.length ? `${conPendiente.length} ${conPendiente.length === 1 ? "deuda" : "deudas"} por pagar` : "Sin deudas pendientes"}
      />
    ),
    cuotas_mes: () => <Kpi icono="calendario" etiqueta="Cuotas del mes" valor={formatearCOP(totalDeudas.delMes)} detalle={`Pagos a deudas en ${nombreDelMes}`} />,
    carga_deuda: () => (
      <Kpi
        icono="alertas"
        etiqueta="Carga de deuda"
        valor={r.ingresosEsperados ? `${cargaDeuda} %` : "—"}
        detalle={!r.ingresosEsperados ? "Sin ingresos para calcularla" : cargaDeuda > 30 ? "Más del 30 % de los ingresos se va en cuotas" : "De los ingresos se va en cuotas"}
      />
    ),
    deuda_libre: () => (
      <Kpi
        icono="meta"
        etiqueta="Libres de deudas"
        valor={!conPendiente.length ? "Ya" : mesesFin ? mesLargo(sumarMeses(mesActual, mesesFin)) : "—"}
        detalle={
          !conPendiente.length ? "No hay deudas pendientes" : mesesFin ? `En ${mesesFin} ${mesesFin === 1 ? "mes" : "meses"} pagando las cuotas` : "Las deudas sin cuota fija no tienen fecha"
        }
      />
    ),
  };

  const secciones: Record<IdSeccion, () => ReactNode> = {
    accesos: () =>
      ctx.puedeEditar ? (
        <div aria-label="Accesos rápidos" className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
          {(
            [
              ["/rapido", "egresos", "Registrar movimiento", "Toma 10 segundos"],
              ["/rapido?modo=foto", "documentos", "Subir un comprobante", "Foto, PDF o captura"],
              ["/importar", "cuentas", "Importar el extracto", "PDF o CSV del banco"],
            ] as const
          ).map(([href, icono, titulo, texto]) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-[14px] border border-borde bg-elevada px-4 py-3.5 text-[15px] font-semibold hover:bg-arena">
              <CuadroIcono nombre={icono} tamano={40} />
              <span>
                {titulo}
                <small className="block text-[13px] font-normal text-cuerpo">{texto}</small>
              </span>
            </Link>
          ))}
        </div>
      ) : null,
    aviso_dian: () => <AvisoDian semaforo={semaforo} />,
    grafico: () => (
      <Tarjeta
        titulo="Ingresos contra gastos"
        subtitulo="Últimos 12 meses, en millones de pesos"
        accion={
          <div className="flex flex-wrap gap-4 text-[13px] text-cuerpo">
            <span className="inline-flex items-center gap-1.5">
              <i className="size-3 rounded-[3px] bg-monte" />
              Ingresos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="size-3 rounded-[3px] bg-teja" />
              Gastos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="rayado-teja size-3 rounded-[3px]" />
              Pronóstico
            </span>
          </div>
        }
      >
        <Grafico filas={todas} mes={mes} />
      </Tarjeta>
    ),
    proximos_pagos: () => (
      <Tarjeta titulo="Próximos pagos" subtitulo="Lo que vence en los próximos 15 días">
        {pendientes.length ? (
          pendientes.map((p) => {
            const cat = p.category_id ? porId.get(p.category_id) : undefined;
            return (
              <FilaLista
                key={p.clave}
                icono={iconoCategoria(cat?.nombre ?? p.nombre)}
                titulo={p.nombre || cat?.nombre || "Pago programado"}
                detalle={p.fecha < hoyISO ? `Vencido · ${formatearDia(p.fecha)}` : `Vence el ${formatearDia(p.fecha)}`}
                valor={formatearCOP(p.monto)}
              />
            );
          })
        ) : (
          <p className="py-4 text-sm text-tenue">No hay pagos programados en los próximos días.</p>
        )}
        <Link href="/recurrentes" className="mt-3 inline-flex h-9 items-center text-sm font-semibold hover:underline">
          Ver todos los pagos fijos →
        </Link>
      </Tarjeta>
    ),
    top_categorias: () => (
      <Tarjeta
        titulo="Top de categorías contra presupuesto"
        subtitulo={`Las ${top.length || 5} categorías donde más has gastado en ${nombreDelMes}`}
        accion={
          <EnlaceBoton href={conPlan ? "/presupuesto" : `/presupuesto?mes=${mes}`} variante="secundario" className="h-9 px-3 text-sm">
            Ver presupuesto
          </EnlaceBoton>
        }
      >
        {top.length ? (
          <ul>
            {top.map((c) => (
              <li key={c.id} className="border-b border-divisor last:border-b-0">
                <Link
                  href={`/movimientos?mes=${mes}&categoria=${c.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_180px_96px] lg:grid-cols-[minmax(200px,1.2fr)_minmax(0,2fr)_200px_104px] lg:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-3 text-[15px] font-semibold">
                    <CuadroIcono nombre={iconoCategoria(c.nombre)} />
                    <span className="truncate">{c.nombre}</span>
                  </span>
                  <span className="col-span-full row-start-2 lg:col-span-1 lg:row-start-auto">
                    <Barra porcentaje={c.porcentaje} tono={SEM[c.semaforo].tono} gruesa />
                  </span>
                  <span className="row-start-3 text-sm text-cuerpo md:row-start-auto md:text-right">
                    <b className="text-tinta">{formatearCOP(c.real)}</b> de {formatearCOP(c.presupuesto)}
                  </span>
                  <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
                    <Chip tono={SEM[c.semaforo].tono}>{SEM[c.semaforo].texto}</Chip>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tenue">Aún no hay gastos en {nombreDelMes}.</p>
        )}
        {(sinCategoria ?? 0) > 0 && (
          <div className="mt-3">
            <Aviso tipo="info">
              <Link href={`/movimientos?mes=${mes}&categoria=sin`} className="font-semibold underline">
                {sinCategoria} movimientos sin categoría
              </Link>
              : clasifícalos para afinar el número mínimo.
            </Aviso>
          </div>
        )}
      </Tarjeta>
    ),
    deudas: () => (
      <Tarjeta
        titulo="Deudas"
        subtitulo={deudas.length ? `Faltan ${formatearCOP(totalDeudas.pendiente)} en total` : "Créditos, compras a cuotas y préstamos"}
        accion={
          <EnlaceBoton href="/deudas" variante="secundario" className="h-9 px-3 text-sm">
            Ver deudas
          </EnlaceBoton>
        }
      >
        {deudas.length ? (
          <ul>
            {deudas.slice(0, 6).map((d) => (
              <li key={d.id} className="border-b border-divisor py-3 last:border-b-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <b className="truncate text-[15px]">{d.nombre}</b>
                  <span className="shrink-0 text-sm text-cuerpo">{d.pendiente ? `Faltan ${formatearCOP(d.pendiente)}` : "Pagada"}</span>
                </div>
                <Barra porcentaje={d.porcentaje} />
                <p className="mt-1 text-[13px] text-tenue">
                  {d.porcentaje} % pagado{d.mesesRestantes && d.pendiente ? ` · termina en ${mesLargo(sumarMeses(mesActual, d.mesesRestantes))}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-tenue">No hay deudas registradas.</p>
        )}
      </Tarjeta>
    ),
    metas: () => (
      <Tarjeta
        titulo="Metas de ahorro"
        subtitulo={metas.length ? `${formatearCOP(totalMetas.ahorrado)} de ${formatearCOP(totalMetas.objetivo)}` : "Fondo de emergencia, viaje, estudio…"}
        accion={
          <EnlaceBoton href="/metas" variante="secundario" className="h-9 px-3 text-sm">
            Ver metas
          </EnlaceBoton>
        }
      >
        {metas.length ? (
          <ul>
            {metas.slice(0, 6).map((m) => (
              <li key={m.id} className="border-b border-divisor py-3 last:border-b-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <b className="truncate text-[15px]">{m.nombre}</b>
                  <span className="shrink-0 text-sm text-cuerpo">
                    {formatearCOP(m.ahorrado)} de {formatearCOP(m.monto)}
                  </span>
                </div>
                <Barra porcentaje={m.porcentaje} tono={m.estado === "atrasada" ? "alerta" : "ok"} />
                <p className="mt-1 text-[13px] text-tenue">
                  {m.estado === "cumplida" ? "¡Cumplida!" : m.estado === "atrasada" ? "Va atrasada" : m.estado === "a_tiempo" ? "Va a tiempo" : `${m.porcentaje} % ahorrado`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-tenue">Aún no hay metas de ahorro.</p>
        )}
      </Tarjeta>
    ),
    academia: () => (
      <section aria-label="Academia" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Aprende en la Academia</h2>
          <Link href="/academia" className="inline-flex h-9 items-center px-3 text-sm font-semibold hover:underline">
            Ver todo
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {academia.map((a) => (
            <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-[14px] border border-borde bg-elevada px-4 py-3.5 hover:bg-arena">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-arena">
                <Icono nombre={a.icono} tamano={22} />
              </span>
              <span>
                <small className="block text-xs font-semibold tracking-[0.02em] text-cuerpo uppercase">{a.etiqueta}</small>
                <b className="text-[15px] leading-5">{a.titulo}</b>
              </span>
            </Link>
          ))}
        </div>
      </section>
    ),
  };

  // En escritorio, una sección ancha (gráfico, top) junto a una angosta vecina (pagos, deudas, metas) comparten fila.
  const ANCHAS: IdSeccion[] = ["grafico", "top_categorias"];
  const ANGOSTAS: IdSeccion[] = ["proximos_pagos", "deudas", "metas"];
  const ancho = new Map<IdSeccion, string>();
  for (let i = 0; i < panel.secciones.length - 1; i++) {
    const [a, b] = [panel.secciones[i], panel.secciones[i + 1]];
    if ((ANCHAS.includes(a) && ANGOSTAS.includes(b)) || (ANGOSTAS.includes(a) && ANCHAS.includes(b))) {
      ancho.set(a, ANCHAS.includes(a) ? "lg:col-span-2" : "lg:col-span-1");
      ancho.set(b, ANCHAS.includes(b) ? "lg:col-span-2" : "lg:col-span-1");
      i++;
    }
  }

  return (
    <>
      {encabezado}
      {editor}
      <div className="space-y-4 md:space-y-5">
        {panel.indicadores.length > 0 && (
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {panel.indicadores.map((id) => (
              <Fragment key={id}>{indicadores[id]()}</Fragment>
            ))}
          </section>
        )}

        {conPlan && !reglas.some((g) => g.tipo === "gasto") && ctx.puedeEditar && (
          <Aviso tipo="info">
            Aún no tienes pagos fijos: el pronóstico solo cuenta lo que registras.{" "}
            <Link href="/recurrentes?nuevo=1" className="font-semibold underline">
              Carga el arriendo, los servicios y demás en Pagos fijos
            </Link>{" "}
            para verlo completo desde el primer día del mes.
          </Aviso>
        )}

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
          {panel.secciones.map((id) => {
            const contenido = secciones[id]();
            return contenido ? (
              <div key={id} className={cx("min-w-0", ancho.get(id) ?? "lg:col-span-3")}>
                {contenido}
              </div>
            ) : null;
          })}
        </div>
      </div>
    </>
  );
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Deudas, metas y saldos: solo si algún indicador o sección del panel los usa. */
async function cargarExtras(ctx: Awaited<ReturnType<typeof obtenerContexto>>, pide: ReturnType<typeof datosNecesarios>, fecha: string) {
  const mes = mesDe(fecha);
  const nada = Promise.resolve({ data: null });
  const [deudas, movDeudas, metas, movMetas, cuentas, saldos] = await Promise.all([
    pide.deudas ? ctx.supabase.from("debts").select("id, nombre, monto, pagado_inicial, cuota, cuotas_total").eq("archivada", false).order("created_at") : nada,
    pide.deudas ? ctx.supabase.from("transactions").select("debt_id, monto, estado, fecha").not("debt_id", "is", null) : nada,
    pide.metas
      ? ctx.supabase.from("budgets_goals").select("id, nombre, monto, ahorrado_inicial, aporte_mensual, fecha_objetivo").eq("tipo", "meta").order("es_emergencia", { ascending: false })
      : nada,
    pide.metas ? ctx.supabase.from("transactions").select("goal_id, monto").not("goal_id", "is", null).eq("estado", "confirmado") : nada,
    pide.saldos ? ctx.supabase.from("accounts").select("id, tipo, cupo").eq("archivada", false) : nada,
    pide.saldos ? ctx.supabase.from("account_balances").select("account_id, saldo") : nada,
  ]);
  const listaDeudas = (deudas.data ?? []).map((d) => {
    const suyos = (movDeudas.data ?? []).filter((m) => m.debt_id === d.id);
    const abonos = suyos.filter((m) => m.estado === "confirmado").reduce((s, m) => s + m.monto, 0);
    const delMes = suyos.filter((m) => m.fecha.startsWith(mes)).reduce((s, m) => s + m.monto, 0);
    return { id: d.id, nombre: d.nombre, delMes, ...avanceDeuda({ ...d, abonos }) };
  });
  const aportes = new Map<string, number>();
  for (const a of movMetas.data ?? []) aportes.set(a.goal_id!, (aportes.get(a.goal_id!) ?? 0) + a.monto);
  const listaMetas = (metas.data ?? []).map((m) => {
    const ahorrado = (m.ahorrado_inicial ?? 0) + (aportes.get(m.id) ?? 0);
    return {
      id: m.id,
      nombre: m.nombre,
      monto: m.monto ?? 0,
      ahorrado,
      ...avanceMeta({ objetivo: m.monto ?? 0, ahorrado, aporteMensual: m.aporte_mensual, fechaObjetivo: m.fecha_objetivo }, fecha),
    };
  });
  const saldo = new Map((saldos.data ?? []).map((s) => [s.account_id, s.saldo ?? 0]));
  const activas = cuentas.data ?? [];
  const tarjetas = activas.filter((c) => c.tipo === "tarjeta");
  return {
    deudas: listaDeudas,
    metas: listaMetas,
    saldos: {
      disponible: activas.filter((c) => c.tipo !== "tarjeta").reduce((s, c) => s + (saldo.get(c.id) ?? 0), 0),
      usadoTarjetas: tarjetas.reduce((s, c) => s + Math.max(0, -(saldo.get(c.id) ?? 0)), 0),
      cupoTarjetas: tarjetas.reduce((s, c) => s + (c.cupo ?? 0), 0),
    },
  };
}

/** Aviso de Renta: quien ya alcanzó un tope (rojo) o está cerca (amarillo). */
function AvisoDian({ semaforo }: { semaforo: SemaforoAnio | null }) {
  if (!semaforo?.ok || !semaforo.personas.length) return null;
  const peor = (["rojo", "amarillo", "verde"] as const).find((e) => semaforo.personas.some((p) => p.estado === e))!;
  const afectadas = semaforo.personas.filter((p) => p.estado === peor);
  const otras = semaforo.personas.filter((p) => p.estado !== peor);
  const mayor = (p: (typeof afectadas)[number]) => p.topes.reduce((a, b) => (b.porcentaje > a.porcentaje ? b : a));
  const lista = (ps: { nombre: string }[]) => ps.map((p) => p.nombre).join(" y ");
  const t = mayor(afectadas[0]);

  const contenido = {
    rojo: {
      titulo: `Renta ${semaforo.anio}: ${lista(afectadas)} ${afectadas.length > 1 ? "deberán" : "deberá"} declarar en ${semaforo.anio + 1}`,
      texto: `${t.nombre}: ${formatearCOP(t.acumulado)}, sobre el tope de ${formatearCOP(t.tope)} (${t.topeUnidades.toLocaleString("es-CO")} ${semaforo.jurisdiccion.unidad}).${otras.length ? ` ${lista(otras)} ${otras.length > 1 ? "siguen" : "sigue"} bajo los topes.` : ""}`,
      clases: "bg-error-fondo text-error-tinta",
    },
    amarillo: {
      titulo: `Renta ${semaforo.anio}: ${lista(afectadas)} ${afectadas.length > 1 ? "están" : "está"} cerca de un tope`,
      texto: `${t.nombre} va en el ${t.porcentaje} % del tope de ${formatearCOP(t.tope)}. Revisa los soportes con tiempo.`,
      clases: "bg-alerta-fondo text-alerta-tinta",
    },
    verde: {
      titulo: `Renta ${semaforo.anio}: nadie del hogar está cerca de los topes`,
      texto: "My House sigue los acumulados del año con cada movimiento que registras.",
      clases: "bg-ok-fondo text-ok-tinta",
    },
  }[peor];

  return (
    <section aria-label="Estado DIAN" className={cx("flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4", contenido.clases)}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
        <Icono nombre="declaracion-renta" tamano={22} acento={false} />
      </span>
      <div className="min-w-0 flex-[1_1_320px]">
        <strong className="block text-base leading-[22px]">{contenido.titulo}</strong>
        <span className="text-sm">{contenido.texto}</span>
      </div>
      <EnlaceBoton href="/impuestos" variante="secundario" className="h-9 border-current! bg-transparent! px-3 text-sm text-current!">
        Ver Renta DIAN
      </EnlaceBoton>
    </section>
  );
}

/** Barras de ingresos y gastos de 12 meses; los gastos programados se apilan rayados sobre los confirmados. */
function Grafico({ filas, mes }: { filas: TotalCategoria[]; mes: string }) {
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(mes, i - 11));
  const datos = meses.map((m) => {
    const delMes = filas.filter((f) => f.mes.startsWith(m));
    const suma = (tipo: string, estado: string) => delMes.filter((f) => f.tipo === tipo && f.estado === estado).reduce((s, f) => s + f.total, 0);
    return { m, ingresos: suma("ingreso", "confirmado"), gastos: suma("gasto", "confirmado"), programados: suma("gasto", "programado") };
  });
  const maximo = Math.max(...datos.map((d) => Math.max(d.ingresos, d.gastos + d.programados)), 1);
  // Tope del eje redondeado hacia arriba a un paso "bonito" (1, 2 o 5 × 10^n) para que las 3 divisiones lean bien.
  const base = 10 ** Math.floor(Math.log10(maximo / 3));
  const paso = [1, 2, 5, 10].map((k) => k * base).find((p) => p * 3 >= maximo)!;
  const tope = paso * 3;
  const alto = (v: number) => `${((v / tope) * 100).toFixed(1)}%`;
  const descripcion = datos.filter((d) => d.ingresos >= d.gastos + d.programados).length;

  return (
    <div
      className="flex h-[190px] gap-1.5 md:h-60 md:gap-3"
      role="img"
      aria-label={`Gráfico de barras de ingresos y gastos de los últimos 12 meses. Los ingresos cubren los gastos en ${descripcion} de 12 meses.`}
    >
      <div className="flex w-[30px] shrink-0 flex-col justify-between pb-6 text-right text-[11px] text-tenue md:w-11 md:text-xs">
        {[3, 2, 1, 0].map((k) => (
          <span key={k}>{formatearCorto(paso * k)}</span>
        ))}
      </div>
      <div className="relative grid flex-1 grid-cols-12 gap-0.5 border-b border-borde bg-[linear-gradient(var(--color-divisor)_1px,transparent_1px)] bg-[length:100%_33.33%] md:gap-1.5">
        {datos.map((d) => (
          <div key={d.m} className="flex min-w-0 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-[3px]">
              <div className="w-[42%] max-w-[18px] rounded-t bg-monte" style={{ height: alto(d.ingresos) }} title={`Ingresos ${formatearCOP(d.ingresos)}`} />
              <div className="flex w-[42%] max-w-[18px] flex-col justify-end" style={{ height: alto(d.gastos + d.programados) }} title={`Gastos ${formatearCOP(d.gastos + d.programados)}`}>
                {d.programados > 0 && <div className="rayado-teja rounded-t" style={{ height: `${(d.programados / (d.gastos + d.programados)) * 100}%` }} />}
                <div className={cx("bg-teja", d.programados > 0 ? "" : "rounded-t")} style={{ height: `${(d.gastos / Math.max(1, d.gastos + d.programados)) * 100}%` }} />
              </div>
            </div>
            <div className="-mb-6 h-[18px] text-[11px] text-cuerpo md:text-xs">{etiquetaMesCorto(d.m)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
