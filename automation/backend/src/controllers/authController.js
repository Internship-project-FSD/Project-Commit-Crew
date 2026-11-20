import {
  authenticateDashboardUser,
  readDashboardSession,
  setDashboardSession,
  clearDashboardSession,
  getRoleCredentials,
} from '../services/dashboardAuthService.js';

async function login(req, res, next) {
  try {
    if (!getRoleCredentials().length) {
      return res.status(503).json({ error: 'Dashboard accounts are not configured. Follow the dashboard authentication setup in the configuration guide.' });
    }
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = await authenticateDashboardUser(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid dashboard email or password.' });
    setDashboardSession(res, user);
    return res.json({ user });
  } catch (error) {
    next(error);
  }
}

function currentUser(req, res) {
  const user = readDashboardSession(req);
  if (!user) return res.status(401).json({ error: 'Dashboard session expired. Sign in again.' });
  return res.json({ user });
}

function logout(req, res) {
  clearDashboardSession(res);
  return res.json({ success: true });
}

export { login, currentUser, logout };
