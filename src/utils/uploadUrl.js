import { getApiBaseUrl } from './runtimeConfig.js';

function trimLeadingSlash(v) {
  return String(v || '').replace(/^\/+/, '');
}

/**
 * Construye una URL absoluta (o relativa) para archivos servidos por el backend en `/uploads`.
 * - En dev con proxy, getApiBaseUrl() suele ser vacío; devolvemos ruta relativa.
 * - En producción con frontend separado, devuelve `https://api.../uploads/...`.
 */
export function uploadUrl(relPath) {
  const p = trimLeadingSlash(relPath);
  if (!p) return null;
  const base = String(getApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) return `/uploads/${p}`;
  return `${base}/uploads/${p}`;
}

