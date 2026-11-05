import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, isDemoMode } from '../api/client.js';
import { extractData } from '../api/client.js';

const AuthContext = createContext(null);

function normalizeUser(payload) {
  const data = extractData(payload) || {};
  const user = data.user || data.account || data;
  if (!user || typeof user !== 'object') return null;
  const rawRole = String(user.role || user.user_role || '').toLowerCase();
  const role = rawRole.includes('admin') ? 'admin' : rawRole.includes('manager') ? 'manager' : rawRole;
  return {
    id: user.id ?? user.user_id ?? user.sub ?? 'dashboard-user',
    name: user.name ?? user.fullName ?? user.full_name ?? user.username ?? 'Dashboard user',
    email: user.email ?? user.username ?? '',
    role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dms_dashboard_user') || 'null'); }
    catch { return null; }
  });
  const [checking, setChecking] = useState(!isDemoMode);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    if (isDemoMode) { setChecking(false); return () => { active = false; }; }
    api.me().then((payload) => {
      if (!active) return;
      const normalized = normalizeUser(payload);
      setUser(normalized);
      if (normalized) sessionStorage.setItem('dms_dashboard_user', JSON.stringify(normalized));
    }).catch(() => {
      if (active) setUser(null);
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = () => { setUser(null); setAuthError('Your dashboard session has expired. Sign in again.'); };
    window.addEventListener('dms:unauthorized', handler);
    return () => window.removeEventListener('dms:unauthorized', handler);
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError('');
    const response = await api.login(credentials);
    const data = extractData(response) || {};
    const token = data.token ?? data.accessToken ?? data.access_token;
    const normalized = normalizeUser(response);
    if (!normalized || !['admin', 'manager'].includes(normalized.role)) {
      throw new Error('The login response must include a user with the Admin or Manager role. Confirm the response with Member 2.');
    }
    if (token) sessionStorage.setItem('dms_dashboard_token', token);
    sessionStorage.setItem('dms_dashboard_user', JSON.stringify(normalized));
    setUser(normalized);
    return normalized;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* The local session is cleared even if the API is unavailable. */ }
    sessionStorage.removeItem('dms_dashboard_token');
    sessionStorage.removeItem('dms_dashboard_user');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout, checking, authError, setAuthError, isDemoMode }), [user, login, logout, checking, authError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
