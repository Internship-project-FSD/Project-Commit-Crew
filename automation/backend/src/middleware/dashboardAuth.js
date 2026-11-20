import { readDashboardSession } from '../services/dashboardAuthService.js';

function requireAuth(req, res, next) {
  const user = readDashboardSession(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin role required for this action.' });
    return next();
  });
}

export { requireAuth, requireAdmin };
