import axios from 'axios';

/**
 * Cliente HTTP centralizado: cookies httpOnly para JWT y rutas relativas vía proxy de Vite.
 */
const client = axios.create({
  baseURL: '',
  withCredentials: true,
});

export default client;
