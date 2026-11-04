import { useState } from 'react';
import { apiRequest } from '../services/api';

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (isSignup && password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const endpoint = isSignup
        ? '/auth/signup'
        : '/auth/login';

      const body = isSignup
        ? {
            username: username.trim(),
            email: email.trim(),
            password
          }
        : {
            login: username.trim(),
            password
          };

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setPassword('');
      setConfirmPassword('');

      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark auth-brand-mark">D</div>

        <p className="eyebrow auth-eyebrow">
          DEALERSHIP MANAGEMENT SYSTEM
        </p>

        <h1>
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h1>

        <p className="auth-subtitle">
          {isSignup
            ? 'Register to access the dealership reporting portal.'
            : 'Sign in to access your dealership reports.'}
        </p>

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="username">
            {isSignup ? 'Username' : 'Username or email'}
          </label>

          <input
            id="username"
            data-testid="username"
            type="text"
            autoComplete="username"
            placeholder={
              isSignup
                ? 'Choose a username'
                : 'Enter your username or email'
            }
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            minLength={isSignup ? 3 : undefined}
            maxLength={isSignup ? 40 : 254}
          />

          {isSignup && (
            <>
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                data-testid="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
              />
            </>
          )}

          <label htmlFor="password">Password</label>

          <input
            id="password"
            data-testid="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder={
              isSignup ? 'At least 8 characters' : 'Enter your password'
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={isSignup ? 8 : undefined}
            maxLength={128}
          />

          {isSignup && (
            <>
              <label htmlFor="confirm-password">Confirm password</label>

              <input
                id="confirm-password"
                data-testid="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                required
                minLength={8}
                maxLength={128}
              />
            </>
          )}

          <button
            className="primary-button"
            data-testid="auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Please wait...'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <div className="auth-switch">
          {isSignup ? (
            <>
              Already registered?{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => switchMode('signup')}
              >
                Sign up
              </button>
            </>
          )}
        </div>

        <p className="security-note">
          Accounts are stored in PostgreSQL. Passwords are hashed before storage.
        </p>
      </section>
    </main>
  );
}