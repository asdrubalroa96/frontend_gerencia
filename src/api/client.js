import axios from 'axios';
import { getApiBaseUrl } from '../utils/runtimeConfig.js';

/**
 * Cliente HTTP centralizado: cookies httpOnly para JWT y rutas relativas vía proxy de Vite.
 */
const client = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

export default client;
