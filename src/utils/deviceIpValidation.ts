function isValidIpv4(s: string): boolean {
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (p === '' || p.length > 3) return false;
    if (p.length > 1 && p[0] === '0') return false;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
}

function isValidIpv6Literal(ip: string): boolean {
  if (!ip.includes(':')) return false;
  try {
    new URL(`http://[${ip}]/`);
    return true;
  } catch {
    return false;
  }
}

export type DeviceIpValidation = { ok: true; normalized: string } | { ok: false; message: string };

/**
 * Vérifie le format d’une IP pour un appareil IoT (IPv4 ou IPv6).
 */
export function validateDeviceIpAddress(raw: string): DeviceIpValidation {
  const ip = raw.trim();
  if (!ip) {
    return { ok: false, message: 'L’adresse IP du Raspberry est obligatoire.' };
  }
  if (isValidIpv4(ip)) {
    return { ok: true, normalized: ip };
  }
  if (isValidIpv6Literal(ip)) {
    return { ok: true, normalized: ip };
  }
  return {
    ok: false,
    message:
      'Adresse IP invalide. Utilisez une IPv4 (ex. 192.168.1.10) ou une IPv6 correcte (sans crochets).',
  };
}
