import os from 'os';

/**
 * Détecte automatiquement l'adresse IP locale active (Wi-Fi ou Ethernet)
 * pour éviter les ruptures de communication lors des changements de réseau Wi-Fi
 */
export function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      // Ignorer l'IPv6, les interfaces internes (loopback) et les réseaux virtuels Hyper-V/WSL
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !name.toLowerCase().includes('vethernet') &&
        !name.toLowerCase().includes('bluetooth') &&
        !name.toLowerCase().includes('virtual')
      ) {
        return iface.address;
      }
    }
  }

  // Fallback si seule une interface classique est dispo
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return 'localhost';
}

export function getPublicBaseUrl(): string {
  const ip = getLocalIpAddress();
  if (ip && ip !== 'localhost') {
    return `http://${ip}:5173`;
  }
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }
  return 'http://localhost:5173';
}

