/**
 * Equipo y permisos → «Ingreso solo desde IP permitidas». Puro y liviano (lo usa el proxy en cada pantalla de la
 * consola). IPv4 con o sin máscara (190.85.10.0/24) e IPv6 exacta. Lista vacía = nadie queda por fuera.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipv4(ip: string): number | null {
  const m = ip.match(IPV4);
  if (!m) return null;
  const partes = m.slice(1).map(Number);
  if (partes.some((n) => n > 255)) return null;
  return ((partes[0] << 24) | (partes[1] << 16) | (partes[2] << 8) | partes[3]) >>> 0;
}

/** Normaliza «::ffff:1.2.3.4» y quita espacios. */
const limpia = (ip: string) => ip.trim().toLowerCase().replace(/^::ffff:/, "");

export function reglaValida(regla: string): boolean {
  const [ip, mascara] = limpia(regla).split("/");
  if (ipv4(ip) !== null) return mascara === undefined || (/^\d{1,2}$/.test(mascara) && Number(mascara) <= 32);
  return mascara === undefined && /^[0-9a-f:]{2,39}$/.test(ip) && ip.includes(":");
}

export function ipPermitida(ip: string, reglas: string[]): boolean {
  if (!reglas.length) return true;
  const x = limpia(ip);
  const n = ipv4(x);
  return reglas.some((r) => {
    const [base, mascara] = limpia(r).split("/");
    const b = ipv4(base);
    if (n !== null && b !== null) {
      const bits = mascara === undefined ? 32 : Number(mascara);
      const m = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (n & m) === (b & m);
    }
    return base === x;
  });
}
