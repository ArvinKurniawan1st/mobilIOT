import axios from 'axios';
import { CONFIG } from '../config';

const apiClient = axios.create({
  baseURL: CONFIG.API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Waypoints API
export const waypointsAPI = {
  getAll: () => apiClient.get('/api/waypoints'),
  create: (data) => apiClient.post('/api/waypoints', data),
  update: (id, data) => apiClient.put(`/api/waypoints/${id}`, data),
  delete: (id) => apiClient.delete(`/api/waypoints/${id}`)
};

// Vehicle API
export const vehicleAPI = {
  getInfo: () => apiClient.get('/api/vehicle'),
  updateStatus: (status) => apiClient.put('/api/vehicle/status', { status })
};

// Telemetry API
export const telemetryAPI = {
  getLatest: () => apiClient.get('/api/telemetry/latest'),
  getHistory: (params) => apiClient.get('/api/telemetry/history', { params })
};

// Trips API
export const tripsAPI = {
  getAll: () => apiClient.get('/api/trips'),
  getActive: () => apiClient.get('/api/trips/active'),
  start: (data) => apiClient.post('/api/trips', data),
  end: (id, data) => apiClient.put(`/api/trips/${id}/end`, data),
  cancel: (id) => apiClient.put(`/api/trips/${id}/cancel`)
};

// Control API
export const controlAPI = {
  sendCommand: (command, data) => 
    apiClient.post('/api/control/command', { command, data })
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () => apiClient.get('/api/analytics/dashboard')
};

export default apiClient;