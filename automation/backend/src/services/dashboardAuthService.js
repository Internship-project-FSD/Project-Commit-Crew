import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = 'dms_dashboard_session';
const SESSION_SECONDS = 8 * 60 * 60;

function getRoleCredentials() {
  return [
    { role: 'admin', email: process.env.DASHBOARD_ADMIN_EMAIL, passwordHash: process.env.DASHBOARD_ADMIN_PASSWORD_HASH, name: process.env.DASHBOARD_ADMIN_NAME || 'Dealership IT Admin' },
    { role: 'manager', email: process.env.DASHBOARD_MANAGER_EMAIL, passwordHash: process.env.DASHBOARD_MANAGER_PASSWORD_HASH, name: process.env.DASHBOARD_MANAGER_NAME || 'Dealership Manager' },
  ].filter((account) => account.email && account.passwordHash);
}

function getSessionSecret() {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Dashboard authentication is not configured. Set DASHBOARD_SESSION_SECRET (32+ characters).');
  return secret;
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || !storedHash) return false;
  const parts = String(storedHash).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'base64url');
    const expected = Buffer.from(parts[2], 'base64url');
    if (!salt.length || !expected.length) return false;
    const actual = await scrypt(password, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function authenticateDashboardUser(email, password) {
  const account = getRoleCredentials().find((candidate) => candidate.email.toLowerCase() === String(email || '').trim().toLowerCase());
  if (!account || !(await verifyPassword(password, account.passwordHash))) return null;
  return { id: account.role, name: account.name, email: account.email, role: account.role };
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

function readDashboardSession(req, now = Date.now()) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  let expected;
  try { expected = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url'); }
  catch { return null; }
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp <= Math.floor(now / 1000) || !['admin', 'manager'].includes(payload.role)) return null;
    return { id: payload.role, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

function setDashboardSession(res, user) {
  const token = signPayload({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`);
}

function clearDashboardSession(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

export {
  COOKIE_NAME,
  authenticateDashboardUser,
  getRoleCredentials,
  getSessionSecret,
  readDashboardSession,
  setDashboardSession,
  clearDashboardSession,
  verifyPassword,
  signPayload,
};
