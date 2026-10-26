import { Capacitor } from '@capacitor/core';

export function validateApiBaseUrl(value: string | undefined, production: boolean, native: boolean): string {
  const configured = value?.trim() ?? '';
  if (!configured && !production && !native) return '';
  const message = 'Set VITE_API_BASE_URL to an HTTPS API origin before building NIYA.';
  let url: URL;
  try { url = new URL(configured); } catch { throw new Error(message); }
  const localDevelopment = !production && !native && url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localDevelopment) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error(message);
  return url.origin;
}

export function getApiBaseUrl(): string {
  return validateApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD,
    Capacitor.isNativePlatform());
}
