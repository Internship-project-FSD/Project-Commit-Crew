import { useEffect, useState } from 'react';

import { apiRequest } from './services/api';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const data = await apiRequest('/auth/me');

        if (!cancelled) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingSession) {
    return (
      <main className="loading-screen">
        <div className="spinner" />
        <p>Checking your session...</p>
      </main>
    );
  }

  if (user) {
    return (
      <DashboardPage
        user={user}
        onLogout={() => setUser(null)}
      />
    );
  }

  return (
    <AuthPage onAuthenticated={setUser} />
  );
}