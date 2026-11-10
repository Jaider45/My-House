/*
 * Integraciones que el equipo conecta desde la consola (Sistema → Integraciones). Módulo liviano: lo usa la pantalla.
 * Los campos deben coincidir con private.campos_integracion (migración integraciones).
 */

export type Proveedor = "resend" | "wompi" | "whatsapp" | "anthropic" | "openai";

export type Campo = {
  clave: string;
  etiqueta: string;
  secreto: boolean;
  placeholder?: string;
  ayuda?: string;
  opcional?: boolean;
};

export type Integracion = {
  proveedor: Proveedor;
  nombre: string;
  categoria: "Correo" | "Pagos" | "Mensajería" | "Inteligencia artificial";
  descripcion: string;
  campos: Campo[];
  /** Ruta del webhook que hay que pegar en el panel del proveedor (si tiene). */
  webhook?: string;
  pasos: string[];
  docs: string;
};

export const INTEGRACIONES: Integracion[] = [
  {
    proveedor: "resend",
    nombre: "Correo · Resend",
    categoria: "Correo",
    descripcion: "Bienvenida, invitaciones, recibos de pago, renovaciones, recordatorios y avisos de la DIAN.",
    campos: [
      { clave: "api_key", etiqueta: "API key", secreto: true, placeholder: "re_…" },
      { clave: "remitente", etiqueta: "Remitente", secreto: false, placeholder: "My House <no-responder@tu-dominio.com>", ayuda: "Con un dominio verificado en Resend." },
      { clave: "webhook_secret", etiqueta: "Secreto del webhook", secreto: true, opcional: true, placeholder: "whsec_…", ayuda: "Para medir entregas, aperturas y clics: Webhooks → Add webhook con la URL de abajo y pega aquí el signing secret." },
    ],
    webhook: "/api/correos/webhook",
    pasos: [
      "Crea una cuenta en resend.com y agrega tu dominio. Copia los registros SPF y DKIM en tu proveedor de dominio y espera «Verified».",
      "API Keys → Create API key con permiso «Sending access».",
      "Pega la llave y el remitente, guarda y usa «Enviar correo de prueba».",
      "Los correos de acceso (código para entrar, restablecer contraseña) los envía Supabase: en su panel, Authentication → SMTP, usa host smtp.resend.com, usuario resend y la misma llave.",
    ],
    docs: "https://resend.com/docs/dashboard/api-keys/introduction",
  },
  {
    proveedor: "wompi",
    nombre: "Pagos · Wompi",
    categoria: "Pagos",
    descripcion: "Cobro de los planes con tarjeta, PSE, Nequi, Daviplata y Bancolombia.",
    campos: [
      { clave: "llave_publica", etiqueta: "Llave pública", secreto: false, placeholder: "pub_test_… o pub_prod_…" },
      { clave: "integridad", etiqueta: "Secreto de integridad", secreto: true, placeholder: "test_integrity_… o prod_integrity_…" },
      { clave: "eventos", etiqueta: "Secreto de eventos", secreto: true, placeholder: "test_events_… o prod_events_…" },
    ],
    webhook: "/api/pagos/wompi",
    pasos: [
      "Crea la cuenta de comercio en comercios.wompi.co (necesita RUT o razón social).",
      "Desarrolladores → Llaves del API: copia la llave pública y los secretos de integridad y de eventos. Empieza con las de pruebas (sandbox).",
      "Desarrolladores → URL de eventos: pega la URL de abajo. Es lo único que da por pagado un plan.",
      "Guarda y prueba la conexión. Cuando todo funcione, cambia a las llaves de producción.",
    ],
    docs: "https://docs.wompi.co/docs/colombia/inicio-rapido/",
  },
  {
    proveedor: "whatsapp",
    nombre: "WhatsApp Business · Meta",
    categoria: "Mensajería",
    descripcion: "Recordatorios y avisos por WhatsApp con plantillas aprobadas por Meta. Más adelante, registrar gastos con un mensaje.",
    campos: [
      { clave: "phone_number_id", etiqueta: "Identificador del número (Phone number ID)", secreto: false, placeholder: "1234567890" },
      { clave: "waba_id", etiqueta: "Identificador de la cuenta (WhatsApp Business Account ID)", secreto: false, placeholder: "1234567890" },
      { clave: "token", etiqueta: "Token de acceso permanente", secreto: true, placeholder: "EAAG…", ayuda: "De un usuario del sistema; los tokens temporales vencen en 24 horas." },
      { clave: "app_secret", etiqueta: "Secreto de la app (App secret)", secreto: true, ayuda: "Para comprobar que los mensajes que llegan son de Meta." },
      { clave: "verify_token", etiqueta: "Token de verificación del webhook", secreto: false, opcional: true, ayuda: "Si lo dejas vacío lo generamos. Pégalo en Meta junto con la URL." },
    ],
    webhook: "/api/whatsapp",
    pasos: [
      "En developers.facebook.com crea una app de tipo Business y agrégale el producto WhatsApp.",
      "En business.facebook.com → Usuarios del sistema, crea uno con los permisos whatsapp_business_messaging y whatsapp_business_management y genera un token sin vencimiento.",
      "WhatsApp → Configuración de la API: copia el identificador del número y el de la cuenta de WhatsApp Business.",
      "Configuración de la app → Básica: copia el secreto de la app.",
      "Guarda aquí. Luego, en WhatsApp → Configuración → Webhook, pega la URL y el token de verificación de abajo y suscríbete a «messages».",
      "Crea las plantillas (recordatorio_pago, pago_fallido, resumen_semanal) en el administrador de WhatsApp y espera la aprobación de Meta.",
    ],
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
  },
  {
    proveedor: "anthropic",
    nombre: "IA · Anthropic (Claude)",
    categoria: "Inteligencia artificial",
    descripcion: "Lectura de comprobantes, facturas y extractos en PDF.",
    campos: [
      { clave: "api_key", etiqueta: "API key", secreto: true, placeholder: "sk-ant-…" },
      { clave: "modelo", etiqueta: "Modelo por defecto", secreto: false, opcional: true, placeholder: "claude-opus-5-5", ayuda: "Cada hogar puede elegir otro en Configuración → Hogar." },
    ],
    pasos: ["En console.anthropic.com → API Keys, crea una llave y agrega créditos en Billing.", "Pégala aquí, guarda y prueba la conexión."],
    docs: "https://docs.claude.com/en/api/overview",
  },
  {
    proveedor: "openai",
    nombre: "IA · OpenAI (GPT)",
    categoria: "Inteligencia artificial",
    descripcion: "Alternativa para leer comprobantes y extractos.",
    campos: [
      { clave: "api_key", etiqueta: "API key", secreto: true, placeholder: "sk-…" },
      { clave: "modelo", etiqueta: "Modelo por defecto", secreto: false, opcional: true, placeholder: "gpt-6.1-sol" },
    ],
    pasos: ["En platform.openai.com → API keys, crea una llave del proyecto y agrega saldo.", "Pégala aquí, guarda y prueba la conexión."],
    docs: "https://platform.openai.com/docs/quickstart",
  },
];

export const integracion = (p: string) => INTEGRACIONES.find((i) => i.proveedor === p);
