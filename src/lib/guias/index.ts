import type { NombreIcono } from "@/components/marca";

/**
 * Guías interactivas («tipo videojuego»): la pantalla se oscurece, solo queda iluminado lo que hay que usar y un
 * globo explica qué es y para qué sirve. Este módulo es puro y liviano (lo importa el motor del navegador).
 *
 * Cada paso:
 * - `ruta`: pantalla donde ocurre. Si no estás ahí, el motor resalta el enlace del menú o te lleva solo.
 *   Con `*` al final es un prefijo (p. ej. el detalle de un movimiento): se espera a que llegues tocando algo.
 * - `objetivo`: selector CSS del elemento a iluminar (se toma el primero visible; si es un campo, se ilumina su
 *   etiqueta completa). Sin objetivo, el globo sale centrado (presentaciones y cierres).
 * - `avance`: `siguiente` (botón del globo), `clic` (al tocar lo iluminado) o `envio` (al enviar su formulario
 *   válido: el navegador no lo envía si falta un campo obligatorio).
 */

export type Avance = "siguiente" | "clic" | "envio";

export type PasoGuia = {
  ruta?: string;
  objetivo?: string;
  titulo: string;
  texto: string;
  avance?: Avance;
  /** Si el objetivo no aparece (p. ej. aún no hay movimientos), qué decir. */
  faltante?: string;
  /** Si este selector ya está visible, el paso sobra y se salta solo (p. ej. un desplegable que ya está abierto). */
  omitirSi?: string;
};

export type IdGuia = "bienvenida" | "cuenta" | "gasto" | "ver_movimiento" | "deuda" | "pago_fijo" | "presupuesto" | "invitar" | "dos_pasos";

export type Guia = {
  id: IdGuia;
  titulo: string;
  descripcion: string;
  icono: NombreIcono;
  /** Quién puede hacerla: las de registrar no sirven para el rol de solo lectura. */
  para: "todos" | "editores" | "admin";
  pasos: PasoGuia[];
};

const MENU = '[aria-label="Navegación principal"]';

export const GUIAS: readonly Guia[] = [
  {
    id: "bienvenida",
    titulo: "Conoce My House",
    descripcion: "Un recorrido por el menú y lo que hace cada sección.",
    icono: "casa",
    para: "todos",
    pasos: [
      {
        titulo: "¡Bienvenido a My House!",
        texto: "En un minuto te muestro dónde está cada cosa. Iluminaré una parte de la pantalla a la vez: lee el globo y toca «Siguiente».",
      },
      {
        ruta: "/",
        objetivo: "main h1",
        titulo: "Tu resumen del mes",
        texto: "Inicio muestra cuánto cuesta sostener la casa este mes: ingresos, gastos, pagos pendientes y tu número mínimo. Con las flechas cambias de mes.",
      },
      {
        ruta: "/",
        objetivo: 'a[href="/rapido"]',
        titulo: "Registrar es lo más importante",
        texto: "Este botón abre el registro rápido: un gasto o ingreso en menos de 10 segundos. Úsalo cada vez que pagues algo.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/movimientos"]`,
        titulo: "Movimientos",
        texto: "La lista de todo lo que entra y sale. Aquí buscas, filtras, corriges y confirmas los pagos programados.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/presupuesto"]`,
        titulo: "Presupuesto",
        texto: "Cuánto planeas gastar por categoría y cómo vas contra eso. El semáforo te avisa antes de pasarte.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/recurrentes"]`,
        titulo: "Pagos fijos",
        texto: "Arriendo, servicios, colegio, salario: lo que se repite. My House los programa solo y te avisa antes de que venzan.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/ajustes"]`,
        titulo: "Configuración y todo lo demás",
        texto: "Cuentas, deudas, metas, Renta DIAN, miembros del hogar y seguridad. En el celular está en «Más».",
      },
      {
        titulo: "¡Listo para empezar!",
        texto: "Cada pantalla tiene un botón «¿Cómo se usa?» que te guía paso a paso. Y en Configuración → Guías están todas. Te recomiendo empezar por registrar tu cuenta bancaria.",
      },
    ],
  },
  {
    id: "cuenta",
    titulo: "Registrar una cuenta bancaria",
    descripcion: "Tu banco, billetera, tarjeta o efectivo, con su saldo de hoy.",
    icono: "cuentas",
    para: "editores",
    pasos: [
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"]',
        titulo: "Aquí agregas tus cuentas",
        texto: "Cada gasto o ingreso sale o entra de una cuenta. Vamos a llenar este formulario campo por campo.",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] [role="radiogroup"]',
        titulo: "¿Qué tipo de cuenta es?",
        texto: "Elige «Cuenta bancaria» para ahorros o corriente. Tarjeta de crédito, billetera (Nequi, Daviplata) y efectivo funcionan igual.",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] [name="entidad"]',
        titulo: "El banco",
        texto: "Escribe el nombre del banco o entidad, por ejemplo Bancolombia o Davivienda.",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] [name="nombre"]',
        titulo: "¿Cómo la quieres ver?",
        texto: "Un nombre corto para reconocerla en las listas, como «Ahorros Bancolombia».",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] [name="ultimos4"]',
        titulo: "Últimos 4 dígitos (opcional)",
        texto: "Te ayudan a distinguir dos cuentas del mismo banco. Nunca te pedimos el número completo ni la clave.",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] [name="titular"]',
        titulo: "¿De quién es?",
        texto: "El titular cuenta para la Renta DIAN: los saldos suman al patrimonio de esa persona. Si es de los dos, déjala compartida.",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] [name="saldo"]',
        titulo: "Saldo de hoy",
        texto: "Lo que tiene la cuenta hoy. Desde aquí My House suma y resta cada movimiento que registres.",
      },
      {
        ruta: "/cuentas",
        objetivo: '[data-guia="form-cuenta"] button[type="submit"]',
        titulo: "Guarda la cuenta",
        texto: "Toca «Guardar». Si falta algo obligatorio, el formulario te lo marca.",
        avance: "envio",
      },
      {
        ruta: "/cuentas",
        objetivo: 'section[aria-label="Tus cuentas"]',
        titulo: "¡Cuenta creada!",
        texto: "Aquí ves tus cuentas con su saldo. Toca una para editarla o archivarla. Repite para tus tarjetas y el efectivo de la casa.",
      },
    ],
  },
  {
    id: "gasto",
    titulo: "Registrar un gasto",
    descripcion: "El registro rápido: monto, categoría y cuenta.",
    icono: "egresos",
    para: "editores",
    pasos: [
      {
        ruta: "/rapido",
        objetivo: 'form [role="radiogroup"][aria-label="Tipo"]',
        titulo: "¿Gasto o ingreso?",
        texto: "Elige «Gasto» cuando sale plata e «Ingreso» cuando entra (salario, ventas, reembolsos).",
      },
      {
        ruta: "/rapido",
        objetivo: 'form [name="monto"]',
        titulo: "¿Cuánto?",
        texto: "Escribe el valor en pesos. Los puntos de miles se ponen solos.",
      },
      {
        ruta: "/rapido",
        objetivo: "form fieldset:nth-of-type(1)",
        titulo: "¿En qué?",
        texto: "Toca la categoría: mercado, transporte, servicios… Las que más usas salen primero. Si no está, búscala en «Otra categoría».",
      },
      {
        ruta: "/rapido",
        objetivo: "form fieldset:nth-of-type(2)",
        titulo: "¿De dónde salió?",
        texto: "Toca la cuenta o tarjeta con la que pagaste. Así el saldo de esa cuenta queda al día.",
        faltante: "Aún no tienes cuentas. Haz primero la guía «Registrar una cuenta bancaria».",
      },
      {
        ruta: "/rapido",
        objetivo: 'form button[type="submit"]',
        titulo: "Guárdalo",
        texto: "Toca el botón para guardar. Se activa cuando eliges categoría y cuenta.",
        avance: "envio",
      },
      {
        ruta: "/rapido",
        objetivo: 'form [role="status"]',
        titulo: "¡Quedó registrado!",
        texto: "Ya cuenta en tu resumen del mes y en el saldo de la cuenta. Desde «Ver movimientos» lo puedes corregir.",
        faltante: "Si no se guardó, revisa el mensaje del formulario y vuelve a intentarlo.",
      },
    ],
  },
  {
    id: "ver_movimiento",
    titulo: "Ver y corregir un movimiento",
    descripcion: "Buscar, filtrar y abrir un movimiento para cambiarlo.",
    icono: "documentos",
    para: "todos",
    pasos: [
      {
        ruta: "/movimientos",
        objetivo: "main h1",
        titulo: "Todos tus movimientos",
        texto: "Aquí está todo lo que entra y sale del mes. Arriba cambias de mes con las flechas.",
      },
      {
        ruta: "/movimientos",
        objetivo: 'form[action="/movimientos"] input[name="q"]',
        titulo: "Busca",
        texto: "Escribe un comercio o concepto, como «Éxito» o «arriendo», para encontrarlo rápido.",
      },
      {
        ruta: "/movimientos",
        objetivo: 'form[action="/movimientos"] select[aria-label="Categoría"]',
        titulo: "Filtra",
        texto: "Con estos selectores ves solo gastos o ingresos, una categoría o una cuenta. Luego toca «Filtrar».",
      },
      {
        ruta: "/movimientos",
        objetivo: 'main a[href^="/movimientos/"]:not([href="/movimientos/nuevo"])',
        titulo: "Abre un movimiento",
        texto: "Tócalo para ver su detalle y corregirlo (en computador, el lápiz al final de la fila).",
        avance: "clic",
        faltante: "Aún no hay movimientos en este mes. Registra uno con el botón Registrar y vuelve a esta guía.",
      },
      {
        ruta: "/movimientos/*",
        objetivo: 'form [name="monto"]',
        titulo: "Corrige lo que necesites",
        texto: "Monto, fecha, cuenta y descripción se pueden cambiar. Lo que cambies se refleja en todo el resumen.",
      },
      {
        ruta: "/movimientos/*",
        objetivo: 'form select[name="category_id"]',
        titulo: "La categoría",
        texto: "Si lo registraste en la categoría equivocada, cámbiala aquí: así el presupuesto y el costo de vida quedan bien.",
      },
      {
        ruta: "/movimientos/*",
        objetivo: "form details > summary",
        titulo: "Más detalles",
        texto: "Aquí se esconden la persona a quien se atribuye, la nota y la etiqueta DIAN. Tócalo para abrirlo.",
        avance: "clic",
        omitirSi: 'form details[open] select[name="tax_tag_id"]',
      },
      {
        ruta: "/movimientos/*",
        objetivo: 'form select[name="tax_tag_id"]',
        titulo: "Etiqueta DIAN",
        texto: "Marca los gastos que sirven en la declaración de renta (salud, educación, intereses de vivienda). Te ahorra trabajo en marzo.",
      },
      {
        ruta: "/movimientos/*",
        objetivo: 'form button[type="submit"]',
        titulo: "Guarda los cambios",
        texto: "Toca «Guardar cambios» cuando termines. Abajo está la opción de eliminarlo si quedó repetido.",
      },
    ],
  },
  {
    id: "deuda",
    titulo: "Registrar una deuda",
    descripcion: "Un préstamo o crédito, con su cuota y sus abonos.",
    icono: "deducciones",
    para: "editores",
    pasos: [
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"]',
        titulo: "Tus deudas en un solo lugar",
        texto: "Préstamos, créditos de libre inversión, Sistecrédito, lo que le debes a un familiar. Vamos campo por campo.",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] [name="nombre"]',
        titulo: "¿Con quién es?",
        texto: "El nombre con que la reconoces: «Préstamo Davivienda», «Crédito moto»…",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] [name="detalle"]',
        titulo: "¿Para qué fue? (opcional)",
        texto: "Una nota corta para recordar de qué se trata.",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] [name="monto"]',
        titulo: "Saldo acordado",
        texto: "El total que debes pagar (lo que te prestaron más los intereses, si ya lo sabes).",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] [name="pagado_inicial"]',
        titulo: "¿Cuánto llevas pagado?",
        texto: "Si ya habías pagado parte antes de registrarla aquí, escríbelo para que el avance sea real.",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] [name="cuota"]',
        titulo: "La cuota",
        texto: "El valor que pagas cada vez. Déjalo vacío si abonas lo que puedas, sin cuota fija.",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] [name="dia_pago"]',
        titulo: "Cuotas y día de pago",
        texto: "Cuántas cuotas son y qué día del mes pagas. Con eso calculamos cuándo terminas.",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="form-deuda"] button[type="submit"]',
        titulo: "Agrégala",
        texto: "Toca «Agregar deuda».",
        avance: "envio",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="abono"]',
        titulo: "Registra cada abono aquí",
        texto: "Cada vez que pagues una cuota, regístrala en este cuadro: queda como gasto en Deudas y la barra de avance se mueve.",
        faltante: "Cuando tengas una deuda registrada, aquí aparece el cuadro para registrar abonos.",
      },
    ],
  },
  {
    id: "pago_fijo",
    titulo: "Crear un pago fijo",
    descripcion: "Arriendo, servicios o tu salario, para que se programen solos.",
    icono: "calendario",
    para: "editores",
    pasos: [
      {
        ruta: "/recurrentes",
        objetivo: "#nuevo",
        titulo: "Lo que se repite, una sola vez",
        texto: "Registra aquí cada pago que se repite. My House lo programa 7 días antes y te avisa para que no se te pase.",
        faltante: "Primero necesitas una cuenta. Haz la guía «Registrar una cuenta bancaria».",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [role="radiogroup"][aria-label="Tipo"]',
        titulo: "¿Pago o ingreso?",
        texto: "«Gasto» para arriendo, servicios, colegio. «Ingreso» para tu salario: así proyectamos tu ahorro.",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [name="descripcion"]',
        titulo: "¿Qué es?",
        texto: "Un nombre claro: «Arriendo», «Internet Claro», «Salario Camila».",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [name="monto"]',
        titulo: "¿Cuánto?",
        texto: "El valor de cada pago. Si cambia un poco cada mes (como la luz), pon un promedio.",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [name="account_id"]',
        titulo: "¿De qué cuenta?",
        texto: "La cuenta de donde sale (o a la que llega, si es ingreso).",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [name="category_id"]',
        titulo: "Categoría",
        texto: "Ubícalo en su categoría para que sume bien en el presupuesto y el costo de vida.",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [name="frecuencia"]',
        titulo: "¿Cada cuánto?",
        texto: "Mensual, quincenal, bimestral, anual…",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo [name="fecha_inicio"]',
        titulo: "¿Qué día?",
        texto: "La fecha de un pago (por ejemplo el próximo). Desde ella se calculan los siguientes.",
      },
      {
        ruta: "/recurrentes",
        objetivo: '#nuevo button[type="submit"]',
        titulo: "Créalo",
        texto: "Toca el botón para crearlo.",
        avance: "envio",
      },
      {
        ruta: "/recurrentes",
        objetivo: "main h1",
        titulo: "¡Programado!",
        texto: "Aparece en el calendario y en la lista. Cuando llegue el día, confírmalo en Movimientos con un toque.",
      },
    ],
  },
  {
    id: "presupuesto",
    titulo: "Armar tu presupuesto",
    descripcion: "Cuánto piensas gastar cada mes en lo que cambia.",
    icono: "mercado",
    para: "editores",
    pasos: [
      {
        ruta: "/presupuesto?editar=1",
        objetivo: 'input[aria-label^="Gasto variable de"]',
        titulo: "Gasto variable por categoría",
        texto: "Los pagos fijos ya cuentan solos. Aquí escribes lo que cambia: cuánto piensas gastar al mes en mercado, transporte, salidas…",
      },
      {
        ruta: "/presupuesto?editar=1",
        objetivo: "form .lg\\:sticky",
        titulo: "Tu presupuesto total",
        texto: "Se suma mientras escribes: fijos + variable. Las categorías esenciales forman tu número mínimo.",
      },
      {
        ruta: "/presupuesto?editar=1",
        objetivo: 'form button[type="submit"]',
        titulo: "Guárdalo",
        texto: "Toca «Guardar presupuesto». Se repite cada mes; lo puedes ajustar cuando quieras.",
        avance: "envio",
      },
      {
        ruta: "/presupuesto",
        objetivo: "main h1",
        titulo: "¡Presupuesto listo!",
        texto: "Ahora ves cuánto llevas gastado por categoría y el semáforo te avisa antes de pasarte.",
      },
    ],
  },
  {
    id: "invitar",
    titulo: "Invitar a alguien al hogar",
    descripcion: "Tu pareja o tu contador, con su propia cuenta.",
    icono: "familia",
    para: "admin",
    pasos: [
      {
        ruta: "/ajustes/miembros",
        objetivo: '[data-guia="invitar"]',
        titulo: "Registren juntos",
        texto: "Quien invites entra con su propio correo y ve el mismo hogar: las mismas cuentas y movimientos.",
      },
      {
        ruta: "/ajustes/miembros",
        objetivo: '[data-guia="invitar"] [name="email"]',
        titulo: "Su correo",
        texto: "Escribe el correo de la persona. Le enviamos la invitación ahí.",
      },
      {
        ruta: "/ajustes/miembros",
        objetivo: '[data-guia="invitar"] [name="rol"]',
        titulo: "¿Qué puede hacer?",
        texto: "Editor: registra y corrige. Administrador: además maneja miembros. Contador: solo mira, ideal para tu declaración.",
      },
      {
        ruta: "/ajustes/miembros",
        objetivo: '[data-guia="invitar"] button[type="submit"]',
        titulo: "Crea la invitación",
        texto: "Toca «Crear invitación».",
        avance: "envio",
      },
      {
        ruta: "/ajustes/miembros",
        objetivo: 'input[aria-label="Enlace de la invitación"]',
        titulo: "Comparte el enlace",
        texto: "También puedes mandarle este enlace por WhatsApp con «Compartir». Al abrirlo, crea su cuenta y entra a tu hogar.",
        faltante: "Si no se creó, revisa el mensaje del formulario (por ejemplo, el límite de personas de tu plan).",
      },
      {
        ruta: "/ajustes/miembros",
        objetivo: '[data-guia="invitaciones"]',
        titulo: "Invitaciones pendientes",
        texto: "Aquí quedan hasta que la acepten. Si te equivocaste, puedes revocarla.",
      },
    ],
  },
  {
    id: "dos_pasos",
    titulo: "Activar la verificación en dos pasos",
    descripcion: "Un código del celular además de tu contraseña.",
    icono: "certificados",
    para: "todos",
    pasos: [
      {
        ruta: "/ajustes/seguridad",
        objetivo: '[data-guia="dos-pasos"]',
        titulo: "Protege tus finanzas",
        texto: "Con la verificación en dos pasos, nadie entra a tu cuenta aunque sepa tu contraseña: también pide un código de tu celular.",
      },
      {
        ruta: "/ajustes/seguridad",
        objetivo: '[data-guia="activar-2fa"]',
        titulo: "Actívala",
        texto: "Necesitas una app autenticadora (Google Authenticator o Microsoft Authenticator). Cuando la tengas, toca «Activar».",
        avance: "clic",
        faltante: "Ya tienes la verificación en dos pasos activa. ¡Bien hecho!",
      },
      {
        ruta: "/ajustes/seguridad",
        objetivo: 'img[alt^="Código QR"]',
        titulo: "Escanea este código",
        texto: "En la app autenticadora toca «+» y escanea el código. Si estás en el mismo celular, copia la clave manual que sale debajo.",
      },
      {
        ruta: "/ajustes/seguridad",
        objetivo: '[data-guia="dos-pasos"] [name="codigo"]',
        titulo: "Escribe el código",
        texto: "La app muestra 6 dígitos que cambian cada 30 segundos. Escribe el que ves ahora.",
      },
      {
        ruta: "/ajustes/seguridad",
        objetivo: '[data-guia="dos-pasos"] button[type="submit"]',
        titulo: "Confirma",
        texto: "Toca «Confirmar». Desde ahora, al entrar te pediremos el código.",
        avance: "envio",
      },
    ],
  },
];

export const guiaPorId = (id: string): Guia | undefined => GUIAS.find((g) => g.id === id);

export function guiasPara(rol: "admin" | "editor" | "contador"): Guia[] {
  return GUIAS.filter((g) => g.para === "todos" || (g.para === "editores" ? rol !== "contador" : rol === "admin"));
}

/**
 * ¿La URL actual corresponde a la ruta del paso? `/x/*` = cualquier subruta de `/x`. Los parámetros de la ruta
 * (`?editar=1`) deben estar en la URL actual; los demás (`mes=…`) no importan.
 */
export function coincideRuta(patron: string, pathname: string, search: string): boolean {
  const [base, consulta] = patron.split("?");
  if (base.endsWith("/*")) {
    const raiz = base.slice(0, -2);
    if (!pathname.startsWith(`${raiz}/`) || pathname.length <= raiz.length + 1) return false;
  } else if (pathname !== base) return false;
  if (!consulta) return true;
  const actual = new URLSearchParams(search);
  return [...new URLSearchParams(consulta)].every(([k, v]) => actual.get(k) === v);
}

/** Lo que el navegador guarda mientras una guía está en curso (sobrevive a recargas de la pestaña). */
export type GuiaEnCurso = { id: IdGuia; paso: number };

export function leerEnCurso(texto: string | null): GuiaEnCurso | null {
  if (!texto) return null;
  try {
    const v = JSON.parse(texto) as Partial<GuiaEnCurso>;
    const g = typeof v.id === "string" ? guiaPorId(v.id) : undefined;
    if (!g || typeof v.paso !== "number" || !Number.isInteger(v.paso) || v.paso < 0 || v.paso >= g.pasos.length) return null;
    return { id: g.id, paso: v.paso };
  } catch {
    return null;
  }
}

/** Guías ya hechas, en `user_metadata.guias` (por persona: lo aprendido no depende del hogar). */
export function leerVistas(userMetadata: unknown): IdGuia[] {
  const v = (userMetadata as { guias?: unknown } | null)?.guias;
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string" && guiaPorId(x)) as IdGuia[]) : [];
}

export const EVENTO_GUIA = "mh:guia";
