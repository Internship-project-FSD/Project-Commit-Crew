import axios from 'axios';
import { demoApi } from './demo.js';

const env = import.meta.env;
export const isDemoMode = env.VITE_DEMO_MODE === 'true';

export const API_PATHS = {
  login: env.VITE_AUTH_LOGIN_PATH || '/api/auth/login',
  me: env.VITE_AUTH_ME_PATH || '/api/auth/me',
  logout: env.VITE_AUTH_LOGOUT_PATH || '/api/auth/logout',
  reports: env.VITE_REPORTS_PATH || '/api/reports',
  runs: env.VITE_RUNS_PATH || '/api/runs',
  files: env.VITE_FILES_PATH || '/api/files',
  health: env.VITE_HEALTH_PATH || '/api/health',
};

export const http = axios.create({
  baseURL: env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: 20000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('dms_dashboard_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('dms_dashboard_token');
      sessionStorage.removeItem('dms_dashboard_user');
      window.dispatchEvent(new CustomEvent('dms:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export const api = {
  async login(credentials) {
    if (isDemoMode) return demoApi.login(credentials);
    return (await http.post(API_PATHS.login, credentials)).data;
  },
  async me() {
    if (isDemoMode) return demoApi.me();
    return (await http.get(API_PATHS.me)).data;
  },
  async logout() {
    if (isDemoMode) return demoApi.logout();
    return http.post(API_PATHS.logout).then((r) => r.data);
  },
  async getHealth() {
    if (isDemoMode) return demoApi.getHealth();
    return (await http.get(API_PATHS.health)).data;
  },
  async getReports() {
    if (isDemoMode) return demoApi.getReports();
    return (await http.get(API_PATHS.reports)).data;
  },
  async updateReport(id, payload) {
    if (isDemoMode) return demoApi.updateReport(id, payload);
    return (await http.put(`${API_PATHS.reports}/${encodeURIComponent(id)}`, payload)).data;
  },
  async getRuns(params = {}) {
    if (isDemoMode) return demoApi.getRuns(params);
    return (await http.get(API_PATHS.runs, { params })).data;
  },
  async startRun(payload) {
    if (isDemoMode) return demoApi.startRun(payload);
    return (await http.post(API_PATHS.runs, payload)).data;
  },
  async getRun(id) {
    if (isDemoMode) return demoApi.getRun(id);
    return (await http.get(`${API_PATHS.runs}/${encodeURIComponent(id)}`)).data;
  },
  async getFile(id) {
    if (isDemoMode) return demoApi.getFile(id);
    return (await http.get(`${API_PATHS.files}/${encodeURIComponent(id)}`)).data;
  },
};

export function extractData(response) {
  if (response == null) return null;
  let current = response;
  if (typeof current === 'object' && 'data' in current) current = current.data;
  if (current && typeof current === 'object' && 'data' in current && !Array.isArray(current.data)) {
    current = current.data;
  }
  return current;
}

export function extractArray(response, preferredKeys = []) {
  const value = extractData(response);
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of [...preferredKeys, 'items', 'results', 'rows']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}
