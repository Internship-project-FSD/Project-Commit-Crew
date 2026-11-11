import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

// Local demonstration identity only.
// This is NOT authenticated or suitable for production access.
const localUser = {
  id: 'local-dashboard-admin',
  name: 'Local Dashboard Admin',
  email: 'local-admin@dms.local',
  role: 'admin',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(localUser);

  // No authentication endpoint exists in the automation backend.
  const checking = false;
  const authError = '';

  const login = useCallback(async () => {
    setUser(localUser);
    return localUser;
  }, []);

  const logout = useCallback(async () => {
    // Keep local access available for this unauthenticated demo.
    setUser(localUser);
  }, []);

  const setAuthError = useCallback(() => {}, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      checking,
      authError,
      setAuthError,
      isLocalAccessMode: true,
    }),
    [user, login, logout, checking, authError, setAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
