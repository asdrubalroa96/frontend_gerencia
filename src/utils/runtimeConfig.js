function trimSlash(v) {
  return String(v || '').trim().replace(/\/+$/, '');
}

/**
 * Resuelve el base URL del API en este orden:
 * 1) VITE_API_BASE_URL (build-time en Vite/Render)
 * 2) window.__RUNTIME_CONFIG__.API_BASE_URL (runtime, sin rebuild)
 * 3) Fallback: backend conocido (Render)
 * 4) Vacío => usa rutas relativas (/api) en desarrollo con proxy
 */
export function getApiBaseUrl() {
  const vite = trimSlash(import.meta.env?.VITE_API_BASE_URL);
  if (vite) return vite;

  const runtime = typeof window !== 'undefined' ? trimSlash(window.__RUNTIME_CONFIG__?.API_BASE_URL) : '';
  if (runtime) return runtime;

  // Fallback para tu despliegue actual
  const fallback = 'https://sistema-gestion-interna-y4tz.onrender.com';
  return trimSlash(fallback);
}

