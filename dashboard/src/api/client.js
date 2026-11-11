import axios from 'axios';
import { demoApi } from './demo.js';

const env = import.meta.env;

export const isDemoMode = env.VITE_DEMO_MODE === 'true';

export const API_PATHS = {
  reports: env.VITE_REPORTS_PATH || '/api/reports',
  runs: env.VITE_RUNS_PATH || '/api/runs',
  health: env.VITE_HEALTH_PATH || '/health',
};

export const http = axios.create({
  baseURL: env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  async getHealth() {
    if (isDemoMode) return demoApi.getHealth();
    return (await http.get(API_PATHS.health)).data;
  },

  async getReports() {
    if (isDemoMode) return demoApi.getReports();
    return (await http.get(API_PATHS.reports)).data;
  },

  async getRuns(params = {}) {
    if (isDemoMode) return demoApi.getRuns(params);
    return (await http.get(API_PATHS.runs, { params })).data;
  },

  async startRun(payload) {
    if (isDemoMode) return demoApi.startRun(payload);

    return (
      await http.post(`${API_PATHS.runs}/start`, payload, {
        timeout: 11 * 60 * 1000,
      })
    ).data;
  },

  async getRun(id) {
    if (isDemoMode) return demoApi.getRun(id);

    return (
      await http.get(`${API_PATHS.runs}/${encodeURIComponent(id)}`)
    ).data;
  },
};

export function extractData(response) {
  if (response == null) return null;

  let current = response;

  if (typeof current === 'object' && 'data' in current) {
    current = current.data;
  }

  if (
    current &&
    typeof current === 'object' &&
    'data' in current &&
    !Array.isArray(current.data)
  ) {
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
