import axios from 'axios';
import { CONFIG } from '../config';

const apiClient = axios.create({
  baseURL: CONFIG.API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

export const waypointsAPI = {
  getAll: () => apiClient.get('/api/waypoints'),
  create: (data) => apiClient.post('/api/waypoints', data),
  delete: (id) => apiClient.delete(`/api/waypoints/${id}`)
};

export const vehicleAPI = {
  getInfo: () => apiClient.get('/api/vehicle')
};

export const telemetryAPI = {
  getLatest: () => apiClient.get('/api/telemetry/latest')
};

export const tripsAPI = {
  getAll: () => apiClient.get('/api/trips'),
  getActive: () => apiClient.get('/api/trips/active'),
  start: (data) => apiClient.post('/api/trips', data),
  end: (id, data) => apiClient.put(`/api/trips/${id}/end`, data)
};

export const controlAPI = {
  sendCommand: (command, data) =>
    apiClient.post('/api/control/command', { command, data })
};

export default apiClient;