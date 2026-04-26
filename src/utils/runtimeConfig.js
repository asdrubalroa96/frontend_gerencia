function trimSlash(v) {
  return String(v || '').trim().replace(/\/+$/, '');
}

/**
 * Resuelve el base URL del API en este orden:
 * 1) VITE_API_BASE_URL (build-time en Vite/Render)
 * 2) window.__RUNTIME_CONFIG__.API_BASE_URL (runtime, sin rebuild)
 * 3) Vacío => usa rutas relativas (/api y /uploads) cuando el frontend está servido por el backend
 *    o cuando usas proxy de Vite en desarrollo.
 */
export function getApiBaseUrl() {
  const vite = trimSlash(import.meta.env?.VITE_API_BASE_URL);
  if (vite) return vite;

  const runtime = typeof window !== 'undefined' ? trimSlash(window.__RUNTIME_CONFIG__?.API_BASE_URL) : '';
  if (runtime) return runtime;

  return '';
}

