import axios from 'axios';

/**
 * Cliente HTTP centralizado: cookies httpOnly para JWT y rutas relativas vía proxy de Vite.
 */
const client = axios.create({
  // En producción (Render) el frontend y backend tienen orígenes distintos.
  // Configurar VITE_API_BASE_URL = https://<tu-backend>.onrender.com
  baseURL: import.meta.env?.VITE_API_BASE_URL || '',
  withCredentials: true,
});

export default client;
