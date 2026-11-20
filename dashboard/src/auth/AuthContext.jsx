import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    api.me()
      .then((response) => { if (active) setUser(response?.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError('');
    const response = await api.login(credentials);
    const authenticatedUser = response?.user;
    if (!authenticatedUser || !['admin', 'manager'].includes(authenticatedUser.role)) {
      throw new Error('The authentication service returned an invalid dashboard account.');
    }
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); }
    finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({
    user, login, logout, checking, authError, setAuthError,
    isLocalAccessMode: false,
  }), [user, login, logout, checking, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
