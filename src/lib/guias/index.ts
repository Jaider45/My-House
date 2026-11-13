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
 * Los formularios de crear viven en ventanas que se abren con `?nuevo=1` (src/components/ui/ventana.tsx): el paso
 * «toca Nueva deuda» avanza con el clic y los siguientes usan la ruta con `?nuevo=1`; si la persona cierra la
 * ventana, el motor la vuelve a abrir.
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

export type IdGuia =
  | "bienvenida"
  | "cuenta"
  | "gasto"
  | "ver_movimiento"
  | "revisar"
  | "importar"
  | "deuda"
  | "pago_fijo"
  | "recordatorio"
  | "presupuesto"
  | "meta"
  | "renta"
  | "asistente"
  | "invitar"
  | "dos_pasos";

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
/** Botón de crear de la pantalla: el del encabezado (desde tablet) o el flotante (celular). */
const crear = (guia: string) => `[data-guia="${guia}"], [data-guia="boton-flotante"]`;

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
        texto: "Inicio muestra cómo va la casa: ingresos, gastos, pagos pendientes, tu número mínimo y el gasto pronosticado al cierre. Con las flechas cambias de mes.",
      },
      {
        ruta: "/",
        objetivo: 'main a[href="/rapido"], [data-guia="boton-flotante"]',
        titulo: "Registrar es lo más importante",
        texto: "Este botón abre Registrar: escribes el monto y en qué fue, o subes la foto del recibo. Toma 10 segundos; úsalo cada vez que pagues algo.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/movimientos"]`,
        titulo: "Movimientos",
        texto: "Todo lo que entra y sale. Tiene tres pestañas: todos los movimientos, lo que el asistente dejó por revisar e importar el extracto del banco.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/recurrentes"]`,
        titulo: "Pagos",
        texto: "Pagos fijos, deudas y recordatorios: lo que hay que pagar y cuándo. El número rojo te avisa si algo se venció.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/presupuesto"]`,
        titulo: "Planea",
        texto: "El presupuesto del mes con su semáforo y tus metas de ahorro, como el fondo de emergencia.",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/impuestos"], ${MENU} a[href="/mas"]`,
        titulo: "Renta DIAN y lo demás",
        texto: "Renta DIAN te dice quién debe declarar y qué soportes guardar. En el celular, eso y las cuentas, la Academia y los ajustes están en «Más».",
      },
      {
        ruta: "/",
        objetivo: `${MENU} a[href="/academia"], ${MENU} a[href="/mas"]`,
        titulo: "Aprende en la Academia",
        texto: "Lecciones cortas sobre la app y la plata de la casa, y todas estas guías paso a paso.",
      },
      {
        titulo: "¡Listo para empezar!",
        texto: "Cada pantalla tiene un botón «¿Cómo se usa?» (el signo de pregunta) que te guía paso a paso. Te recomiendo empezar por registrar tu cuenta bancaria.",
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
        objetivo: crear("agregar-cuenta"),
        titulo: "Agrega una cuenta",
        texto: "Cada gasto o ingreso sale o entra de una cuenta. Toca «Agregar cuenta» para abrir el formulario.",
        avance: "clic",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] [role="radiogroup"]',
        titulo: "¿Qué tipo de cuenta es?",
        texto: "Elige «Cuenta bancaria» para ahorros o corriente. Tarjeta de crédito, billetera (Nequi, Daviplata) y efectivo funcionan igual.",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] [name="entidad"]',
        titulo: "El banco",
        texto: "Escribe el nombre del banco o entidad, por ejemplo Bancolombia o Davivienda.",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] [name="nombre"]',
        titulo: "¿Cómo la quieres ver?",
        texto: "Un nombre corto para reconocerla en las listas, como «Ahorros Bancolombia».",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] [name="ultimos4"]',
        titulo: "Últimos 4 dígitos (opcional)",
        texto: "Te ayudan a distinguir dos cuentas del mismo banco. Nunca te pedimos el número completo ni la clave.",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] [name="titular"]',
        titulo: "¿De quién es?",
        texto: "El titular cuenta para la Renta DIAN: los saldos suman al patrimonio de esa persona. Si es de los dos, déjala compartida.",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] [name="saldo"]',
        titulo: "Saldo de hoy",
        texto: "Lo que tiene la cuenta hoy. Desde aquí My House suma y resta cada movimiento que registres.",
      },
      {
        ruta: "/cuentas?nuevo=1",
        objetivo: '[data-guia="form-cuenta"] button[type="submit"]',
        titulo: "Guarda la cuenta",
        texto: "Toca «Guardar cuenta». Si falta algo obligatorio, el formulario te lo marca.",
        avance: "envio",
      },
      {
        ruta: "/cuentas",
        objetivo: 'section[aria-label="Tus cuentas"]',
        titulo: "¡Cuenta creada!",
        texto: "Aquí ves tus cuentas con su saldo. Con «Editar» la cambias o la archivas. Repite para tus tarjetas y el efectivo de la casa.",
      },
    ],
  },
  {
    id: "gasto",
    titulo: "Registrar un gasto",
    descripcion: "Monto, en qué fue y listo: la categoría se sugiere sola.",
    icono: "egresos",
    para: "editores",
    pasos: [
      {
        ruta: "/rapido",
        objetivo: '[role="tablist"][aria-label="Cómo registrar"]',
        titulo: "Tres formas de registrar",
        texto: "«Escribirlo» para anotarlo tú, «Foto o PDF» para que el asistente lea la factura y «Por WhatsApp» (muy pronto). Vamos con «Escribirlo».",
      },
      {
        ruta: "/rapido",
        objetivo: 'form [role="radiogroup"][aria-label="Tipo"]',
        titulo: "¿Gasto o ingreso?",
        texto: "Elige «Gasto» cuando sale plata e «Ingreso» cuando entra (salario, ventas, reembolsos).",
        faltante: "Para registrar necesitas una cuenta. Haz primero la guía «Registrar una cuenta bancaria».",
      },
      {
        ruta: "/rapido",
        objetivo: 'form [name="monto"]',
        titulo: "¿Cuánto?",
        texto: "Escribe el valor en pesos. Los puntos de miles se ponen solos.",
      },
      {
        ruta: "/rapido",
        objetivo: 'form [name="comercio"]',
        titulo: "¿En qué?",
        texto: "Escríbelo como se lo dirías a alguien: «droguería», «mercado», «Terpel». Si ya lo habías registrado antes, te sugerimos la categoría.",
      },
      {
        ruta: "/rapido",
        objetivo: '[data-guia="sugerencia"], form fieldset, [data-guia="elegir-categoria"]',
        titulo: "Categoría y cuenta",
        texto: "Si te sugerimos una categoría, revísala y toca «Cambiar» si no es. Si no, elige la categoría y la cuenta de donde salió la plata.",
      },
      {
        ruta: "/rapido",
        objetivo: 'form [role="radiogroup"][aria-label="Estado"]',
        titulo: "¿Ya lo pagaste?",
        texto: "«Ya lo pagué» lo cuenta de una vez. «Lo pago después» lo deja pendiente en Movimientos hasta que lo marques como pagado.",
      },
      {
        ruta: "/rapido",
        objetivo: 'form button[type="submit"]',
        titulo: "Guárdalo",
        texto: "Toca «Guardar» (o Enter en el computador). «Guardar y otro» deja la ventana abierta para el siguiente.",
        avance: "envio",
      },
      {
        titulo: "¡Quedó registrado!",
        texto: "Ya cuenta en tu resumen del mes y en el saldo de la cuenta. Si el formulario mostró un error, corrígelo y vuelve a guardar.",
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
        objetivo: 'nav[aria-label="Movimientos"]',
        titulo: "Todos tus movimientos",
        texto: "En «Todos» está lo que entra y sale del mes. «Por revisar» tiene lo que el asistente no pudo registrar solo, e «Importar extracto» trae el mes desde el banco.",
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
        objetivo: 'main a[href^="/movimientos/"]:not([href="/movimientos/nuevo"]):not([href="/movimientos/revisar"])',
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
    id: "revisar",
    titulo: "Resolver lo que quedó por revisar",
    descripcion: "Los comprobantes a los que el asistente les falta un dato.",
    icono: "documentos",
    para: "editores",
    pasos: [
      {
        ruta: "/movimientos/revisar",
        objetivo: 'nav[aria-label="Movimientos"]',
        titulo: "Por revisar",
        texto: "Cuando subes una foto o un PDF, el asistente registra solo lo que entiende. Si le falta un dato (la fecha, la categoría), lo deja en esta pestaña.",
      },
      {
        ruta: "/movimientos/revisar",
        objetivo: '[data-guia="por-revisar"]',
        titulo: "Un comprobante pendiente",
        texto: "Arriba ves lo que leyó: comercio, fecha y monto. Debajo, la pregunta que no pudo responder.",
        faltante: "No hay nada por revisar ahora. Cuando el asistente tenga una duda, aparecerá aquí con un número en el menú.",
      },
      {
        ruta: "/movimientos/revisar",
        objetivo: '[data-guia="por-revisar"] button[type="submit"]',
        titulo: "Complétalo y regístralo",
        texto: "Corrige o completa los campos y toca «Registrar». Si marcas «Recordar la categoría», la próxima vez lo hace solo.",
        avance: "envio",
      },
      {
        titulo: "¡Listo!",
        texto: "Quedó en Movimientos con su comprobante como soporte. Lo que el asistente aprende se ve en Asistente → Reglas que aprendí.",
      },
    ],
  },
  {
    id: "importar",
    titulo: "Importar el extracto del banco",
    descripcion: "Trae el mes completo en PDF o CSV, sin duplicados.",
    icono: "cuentas",
    para: "editores",
    pasos: [
      {
        ruta: "/importar",
        objetivo: '[data-guia="importar-archivo"]',
        titulo: "Elige la cuenta y el archivo",
        texto: "Descarga el extracto desde la banca en línea (PDF o CSV). Aquí eliges a qué cuenta pertenece y subes el archivo.",
        faltante: "Primero crea la cuenta a la que pertenece el extracto: haz la guía «Registrar una cuenta bancaria».",
      },
      {
        ruta: "/importar",
        objetivo: '[data-guia="importar-archivo"]',
        titulo: "Columnas y revisión",
        texto: "Al cargarlo detectamos las columnas, marcamos los posibles duplicados y sugerimos categorías. Tú solo revisas y confirmas.",
      },
      {
        ruta: "/importar",
        objetivo: '[data-guia="importaciones"]',
        titulo: "Si algo salió mal, deshazlo",
        texto: "Cada importación queda aquí. «Deshacer» borra todo lo que trajo ese archivo, sin tocar lo demás.",
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
        objetivo: crear("nueva-deuda"),
        titulo: "Tus deudas en un solo lugar",
        texto: "Préstamos, créditos, Sistecrédito, lo que le debes a un familiar. Toca «Nueva deuda» para registrarla.",
        avance: "clic",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] [name="nombre"]',
        titulo: "¿A quién le debes?",
        texto: "El nombre con que la reconoces: «Préstamo Davivienda», «Crédito moto», «Mamá de Camila».",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] [name="detalle"]',
        titulo: "¿Para qué fue? (opcional)",
        texto: "Una nota corta para recordar de qué se trata.",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] [name="monto"]',
        titulo: "Monto acordado",
        texto: "El total que debes pagar (lo que te prestaron más los intereses, si ya lo sabes).",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] [name="pagado_inicial"]',
        titulo: "¿Cuánto llevas pagado?",
        texto: "Si ya habías pagado parte antes de registrarla aquí, escríbelo para que el avance sea real.",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] [name="cuota"]',
        titulo: "La cuota",
        texto: "El valor que pagas cada mes. Déjalo vacío si abonas lo que puedas, sin cuota fija.",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] [name="dia_pago"]',
        titulo: "Cuotas y día de pago",
        texto: "Cuántas cuotas son y qué día del mes pagas. Con eso calculamos cuándo terminas.",
      },
      {
        ruta: "/deudas?nuevo=1",
        objetivo: '[data-guia="form-deuda"] button[type="submit"]',
        titulo: "Guárdala",
        texto: "Toca «Guardar deuda».",
        avance: "envio",
      },
      {
        ruta: "/deudas",
        objetivo: '[data-guia="abonar"]',
        titulo: "Registra cada abono aquí",
        texto: "Cada vez que pagues una cuota, tócalo: queda como gasto en Deudas y la barra de avance se mueve.",
        faltante: "Cuando tengas una deuda registrada, aquí aparece el botón para registrar abonos.",
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
        objetivo: crear("nuevo-pago-fijo"),
        titulo: "Lo que se repite, una sola vez",
        texto: "Registra aquí cada pago que se repite. My House lo programa 7 días antes y te avisa para que no se te pase. Toca «Nuevo pago fijo».",
        avance: "clic",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [role="radiogroup"][aria-label="Tipo"]',
        titulo: "¿Pago o ingreso?",
        texto: "«Gasto» para arriendo, servicios, colegio. «Ingreso» para tu salario: así proyectamos tu ahorro.",
        faltante: "Primero necesitas una cuenta. Haz la guía «Registrar una cuenta bancaria».",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [name="descripcion"]',
        titulo: "¿Qué pagas?",
        texto: "Un nombre claro: «Arriendo», «Internet Claro», «Salario Camila».",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [name="monto"]',
        titulo: "¿Cuánto?",
        texto: "El valor de cada pago. Si cambia un poco cada mes (como la luz), pon un promedio.",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [name="fecha_inicio"]',
        titulo: "¿Qué día?",
        texto: "La fecha de un pago (por ejemplo el próximo). Desde ella se calculan los siguientes.",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [name="category_id"]',
        titulo: "Categoría",
        texto: "Ubícalo en su categoría para que sume bien en el presupuesto y el costo de vida.",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [name="account_id"]',
        titulo: "¿De qué cuenta?",
        texto: "La cuenta de donde sale (o a la que llega, si es ingreso).",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] [name="frecuencia"]',
        titulo: "¿Cada cuánto?",
        texto: "Mensual, quincenal, bimestral, anual…",
      },
      {
        ruta: "/recurrentes?nuevo=1",
        objetivo: '[data-guia="form-pago-fijo"] button[type="submit"]',
        titulo: "Guárdalo",
        texto: "Toca «Guardar pago fijo».",
        avance: "envio",
      },
      {
        ruta: "/recurrentes",
        objetivo: "main h1",
        titulo: "¡Programado!",
        texto: "Aparece en el calendario y en la lista. Cuando llegue el día, márcalo como pagado con un toque.",
      },
    ],
  },
  {
    id: "recordatorio",
    titulo: "Crear un recordatorio",
    descripcion: "Una fecha de pago que no se te puede pasar: SOAT, matrícula, seguros.",
    icono: "alertas",
    para: "editores",
    pasos: [
      {
        ruta: "/recordatorios",
        objetivo: crear("nuevo-recordatorio"),
        titulo: "Fechas que no se pueden pasar",
        texto: "Para pagos que no son de cada mes o que no quieres programar: el SOAT, la matrícula, un seguro anual. Toca «Nuevo recordatorio».",
        avance: "clic",
      },
      {
        ruta: "/recordatorios?nuevo=1",
        objetivo: '[data-guia="form-recordatorio"] [name="nombre"]',
        titulo: "¿Qué hay que pagar?",
        texto: "Un nombre claro, como «SOAT del carro».",
      },
      {
        ruta: "/recordatorios?nuevo=1",
        objetivo: '[data-guia="form-recordatorio"] [name="fecha"]',
        titulo: "¿Cuándo?",
        texto: "La fecha de pago. El monto es opcional.",
      },
      {
        ruta: "/recordatorios?nuevo=1",
        objetivo: '[data-guia="form-recordatorio"] fieldset:nth-of-type(1)',
        titulo: "¿Se repite?",
        texto: "Una vez, cada mes o cada año.",
      },
      {
        ruta: "/recordatorios?nuevo=1",
        objetivo: '[data-guia="form-recordatorio"] fieldset:nth-of-type(2)',
        titulo: "¿Con cuánta anticipación?",
        texto: "Puedes elegir varios: el mismo día y una semana antes, por ejemplo.",
      },
      {
        ruta: "/recordatorios?nuevo=1",
        objetivo: '[data-guia="form-recordatorio"] button[type="submit"]',
        titulo: "Guárdalo",
        texto: "Toca «Guardar recordatorio». Los avisos por correo llegan a las 7:00 a. m.",
        avance: "envio",
      },
      {
        ruta: "/recordatorios",
        objetivo: 'section[aria-label="Próximas fechas"]',
        titulo: "Tus próximas fechas",
        texto: "Aquí están los recordatorios y los pagos fijos, por mes. Con el interruptor apagas o prendes el aviso.",
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
        ruta: "/presupuesto",
        objetivo: crear("agregar-presupuesto"),
        titulo: "Agrega un presupuesto",
        texto: "Los pagos fijos ya cuentan solos. Aquí planeas lo que cambia: mercado, transporte, salidas. Toca «Agregar presupuesto».",
        avance: "clic",
      },
      {
        ruta: "/presupuesto?nuevo=1",
        objetivo: '[data-guia="form-presupuesto"] select',
        titulo: "La categoría",
        texto: "Elige en qué quieres poner un tope mensual. Si ya tenía, verás cuánto.",
      },
      {
        ruta: "/presupuesto?nuevo=1",
        objetivo: '[data-guia="form-presupuesto"] input[inputmode="numeric"]',
        titulo: "¿Cuánto al mes?",
        texto: "Escribe el monto, o toca una sugerencia: el promedio de tus últimos 3 meses, un poco más o ahorrar el 10 %.",
      },
      {
        ruta: "/presupuesto?nuevo=1",
        objetivo: '[data-guia="quedaria"]',
        titulo: "Tu presupuesto total",
        texto: "Te mostramos cómo quedaría el presupuesto del mes. Se repite cada mes hasta que lo cambies.",
      },
      {
        ruta: "/presupuesto?nuevo=1",
        objetivo: '[data-guia="form-presupuesto"] button[type="submit"]',
        titulo: "Guárdalo",
        texto: "Toca «Guardar presupuesto».",
        avance: "envio",
      },
      {
        ruta: "/presupuesto",
        objetivo: '[aria-label="Semáforo"]',
        titulo: "El semáforo",
        texto: "Verde: vas bien. Amarillo: a este ritmo te pasarás. Rojo: ya te pasaste. Con «Editar presupuesto» cambias todas las categorías a la vez.",
      },
    ],
  },
  {
    id: "meta",
    titulo: "Crear una meta de ahorro",
    descripcion: "El fondo de emergencia, un viaje o la matrícula, con fecha.",
    icono: "ahorro",
    para: "editores",
    pasos: [
      {
        ruta: "/metas",
        objetivo: crear("nueva-meta"),
        titulo: "Ahorra con un propósito",
        texto: "Una meta tiene un monto y una fecha; con eso te decimos cuánto apartar cada mes. Toca «Nueva meta».",
        avance: "clic",
        faltante: "Las metas de ahorro vienen con el plan Familia. Míralo en Configuración → Plan.",
      },
      {
        ruta: "/metas?nuevo=1",
        objetivo: '[data-guia="form-meta"] [name="nombre"]',
        titulo: "¿Para qué ahorras?",
        texto: "Empieza por el fondo de emergencia: de 3 a 6 meses del número mínimo del hogar.",
      },
      {
        ruta: "/metas?nuevo=1",
        objetivo: '[data-guia="form-meta"] [name="monto"]',
        titulo: "¿Cuánto necesitas?",
        texto: "El total que quieres reunir.",
      },
      {
        ruta: "/metas?nuevo=1",
        objetivo: '[data-guia="form-meta"] [name="fecha_objetivo"]',
        titulo: "¿Para cuándo?",
        texto: "Con la fecha calculamos el aporte mensual que necesitas.",
      },
      {
        ruta: "/metas?nuevo=1",
        objetivo: '[data-guia="form-meta"] [name="aporte_mensual"]',
        titulo: "Tu aporte de cada mes",
        texto: "Lo que piensas apartar. Si no alcanza para llegar a tiempo, te avisamos cuánto subirlo.",
      },
      {
        ruta: "/metas?nuevo=1",
        objetivo: '[data-guia="form-meta"] [name="es_emergencia"]',
        titulo: "¿Es el fondo de emergencia?",
        texto: "Márcalo si lo es: se muestra destacado y se mide en meses de tu número mínimo.",
      },
      {
        ruta: "/metas?nuevo=1",
        objetivo: '[data-guia="form-meta"] button[type="submit"]',
        titulo: "Créala",
        texto: "Toca «Crear meta».",
        avance: "envio",
      },
      {
        ruta: "/metas",
        objetivo: '[data-guia="aportar"]',
        titulo: "Aporta cada mes",
        texto: "Cada vez que apartes plata, tócalo: queda como gasto en «Ahorro e inversión» (no cuenta en el costo de vida) y la meta avanza.",
        faltante: "Para aportar necesitas una cuenta de donde sale la plata.",
      },
    ],
  },
  {
    id: "renta",
    titulo: "Entender tu Renta DIAN",
    descripcion: "Quién debe declarar, qué hacer ahora y qué soportes guardar.",
    icono: "declaracion-renta",
    para: "todos",
    pasos: [
      {
        ruta: "/impuestos",
        objetivo: '[aria-label="Quién declara"]',
        titulo: "¿Quién debe declarar?",
        texto: "Una tarjeta por cada adulto del hogar: si ya pasó un tope de la DIAN, si está cerca o si por ahora no tiene que declarar. Toca una para ver sus detalles.",
        faltante: "Para ver el semáforo, el hogar necesita personas adultas y movimientos registrados.",
      },
      {
        ruta: "/impuestos",
        objetivo: '[data-guia="que-hacer"]',
        titulo: "Qué hacer ahora",
        texto: "Los pasos para llegar a la declaración sin afanes, en orden. El que tiene borde verde es el siguiente.",
      },
      {
        ruta: "/impuestos",
        objetivo: 'section[aria-label="Topes de la DIAN"]',
        titulo: "Los topes",
        texto: "Cada medidor compara lo acumulado en el año con un tope. Basta con pasar uno (rojo) para tener que declarar. Amarillo es que va por encima del 70 %.",
      },
      {
        ruta: "/impuestos",
        objetivo: '[data-guia="etiquetas"]',
        titulo: "Totales para el contador",
        texto: "Lo que marcaste con etiqueta DIAN (salud, honorarios, dependientes…), ya sumado. Es lo primero que te va a pedir el contador.",
      },
      {
        ruta: "/impuestos",
        objetivo: "#reporte",
        titulo: "Tu contador",
        texto: "Dale acceso de solo lectura para que vea todo esto sin pedirte archivos. Cálculo orientativo: la decisión final es tuya y de tu contador.",
      },
    ],
  },
  {
    id: "asistente",
    titulo: "Usar el asistente de comprobantes",
    descripcion: "Sube fotos o PDF y deja que los registre solo.",
    icono: "documentos",
    para: "editores",
    pasos: [
      {
        ruta: "/comprobantes",
        objetivo: '[data-guia="compositor"]',
        titulo: "Sube o escribe",
        texto: "Con el clip adjuntas fotos o PDF; con la cámara tomas la foto de la factura. También puedes escribir «almuerzo 25 mil con la Visa».",
        faltante: "El asistente no está configurado en este hogar o tu rol es de solo lectura.",
      },
      {
        ruta: "/comprobantes",
        objetivo: 'section[aria-label="Conversación con el asistente"]',
        titulo: "Lo que encontró",
        texto: "Por cada comprobante te dice qué registró, con la categoría y la cuenta. Si ya existía (un pago fijo, por ejemplo), lo adjunta como soporte y no lo duplica.",
      },
      {
        ruta: "/comprobantes",
        objetivo: '[data-guia="asistente-revisar"], [data-guia="reglas"]',
        titulo: "Por revisar y reglas",
        texto: "Si le falta un dato, lo deja por revisar. Y lo que confirmas lo aprende: la próxima vez categoriza ese comercio solo.",
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
        objetivo: '[data-guia="invitar-miembro"]',
        titulo: "Registren juntos",
        texto: "Quien invites entra con su propio correo y ve el mismo hogar: las mismas cuentas y movimientos. Toca «Invitar miembro».",
        avance: "clic",
      },
      {
        ruta: "/ajustes/miembros?nuevo=1",
        objetivo: '[data-guia="invitar"] [name="email"]',
        titulo: "Su correo",
        texto: "Escribe el correo de la persona. Si hay por dónde enviarlo, le llega la invitación ahí.",
      },
      {
        ruta: "/ajustes/miembros?nuevo=1",
        objetivo: '[data-guia="invitar"] fieldset',
        titulo: "¿Qué puede hacer?",
        texto: "Pareja o familiar: registra y corrige. Administrador: además maneja miembros. Contador: solo mira, ideal para tu declaración.",
      },
      {
        ruta: "/ajustes/miembros?nuevo=1",
        objetivo: '[data-guia="invitar"] button[type="submit"]',
        titulo: "Envía la invitación",
        texto: "Toca «Enviar invitación».",
        avance: "envio",
      },
      {
        ruta: "/ajustes/miembros?nuevo=1",
        objetivo: 'input[aria-label="Enlace de la invitación"]',
        titulo: "Comparte el enlace",
        texto: "Mándale este enlace por WhatsApp con «Compartir». Al abrirlo crea su cuenta y entra a tu hogar. Queda en «Invitaciones pendientes» hasta que la acepte.",
        faltante: "Si no se creó, revisa el mensaje del formulario (por ejemplo, el límite de personas de tu plan).",
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

export function guiasPara(rol: "admin" | "editor" | "contador" | "familiar"): Guia[] {
  // El rol Familiar solo registra gastos: ve las guías de todos y la de registrar un gasto.
  if (rol === "familiar") return GUIAS.filter((g) => g.para === "todos" || g.id === "gasto");
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
