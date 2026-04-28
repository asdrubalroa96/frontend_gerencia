import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sello de build: en Render existe RENDER_GIT_COMMIT (comprueba en la UI que el deploy trajo el último commit).
const rawRef =
  process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || process.env.COMMIT_REF || '';
const buildStamp = rawRef ? String(rawRef).slice(0, 7) : `local-${new Date().toISOString().slice(0, 19)}`;

// Proxy hacia el backend para cookies JWT y archivos /uploads en desarrollo
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
