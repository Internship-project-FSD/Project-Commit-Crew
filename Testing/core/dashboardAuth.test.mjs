import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import {
  COOKIE_NAME,
  authenticateDashboardUser,
  readDashboardSession,
  setDashboardSession,
  signPayload,
} from '../../automation/backend/src/services/dashboardAuthService.js';

const scrypt = promisify(crypto.scrypt);
const envKeys = [
  'DASHBOARD_SESSION_SECRET', 'DASHBOARD_ADMIN_EMAIL', 'DASHBOARD_ADMIN_NAME',
  'DASHBOARD_ADMIN_PASSWORD_HASH', 'DASHBOARD_MANAGER_EMAIL', 'DASHBOARD_MANAGER_NAME',
  'DASHBOARD_MANAGER_PASSWORD_HASH',
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

async function makeHash(password, saltText) {
  const salt = Buffer.from(saltText);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

before(async () => {
  process.env.DASHBOARD_SESSION_SECRET = 'node-core-test-dashboard-session-secret-32-chars-minimum';
  process.env.DASHBOARD_ADMIN_EMAIL = 'admin@example.test';
  process.env.DASHBOARD_ADMIN_NAME = 'Test Admin';
  process.env.DASHBOARD_ADMIN_PASSWORD_HASH = await makeHash('admin-password-123', 'admin-test-salt');
  process.env.DASHBOARD_MANAGER_EMAIL = 'manager@example.test';
  process.env.DASHBOARD_MANAGER_NAME = 'Test Manager';
  process.env.DASHBOARD_MANAGER_PASSWORD_HASH = await makeHash('manager-password-123', 'manager-test-salt');
});

after(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('dashboard auth verifies the Admin account against its stored scrypt hash', async () => {
  const user = await authenticateDashboardUser('ADMIN@example.test', 'admin-password-123');
  assert.deepEqual(user, {
    id: 'admin', name: 'Test Admin', email: 'admin@example.test', role: 'admin',
  });
});

test('dashboard auth verifies the Manager account as a separate role', async () => {
  const user = await authenticateDashboardUser('manager@example.test', 'manager-password-123');
  assert.equal(user.role, 'manager');
});

test('dashboard auth rejects wrong passwords and unknown accounts', async () => {
  assert.equal(await authenticateDashboardUser('admin@example.test', 'wrong-password'), null);
  assert.equal(await authenticateDashboardUser('unknown@example.test', 'admin-password-123'), null);
});

test('dashboard auth writes a signed HttpOnly cookie and reads the assigned role', async () => {
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
  setDashboardSession(response, { id: 'manager', role: 'manager', name: 'Test Manager', email: 'manager@example.test' });
  const cookie = response.headers['Set-Cookie'];
  assert.match(cookie, new RegExp(`${COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  const request = { headers: { cookie: cookie.split(';')[0] } };
  assert.equal(readDashboardSession(request).role, 'manager');
});

test('dashboard auth rejects tampered, expired and unsupported-role sessions', () => {
  const expired = signPayload({ role: 'admin', name: 'Test', email: 'test@example.test', exp: 1 });
  const expiredRequest = { headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(expired)}` } };
  assert.equal(readDashboardSession(expiredRequest), null);

  const tampered = `${expired.slice(0, -1)}x`;
  const tamperedRequest = { headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(tampered)}` } };
  assert.equal(readDashboardSession(tamperedRequest), null);

  const invalidRole = signPayload({ role: 'superadmin', name: 'Test', email: 'test@example.test', exp: Math.floor(Date.now() / 1000) + 60 });
  const invalidRoleRequest = { headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(invalidRole)}` } };
  assert.equal(readDashboardSession(invalidRoleRequest), null);
});

test('dashboard auth safely rejects malformed URL-encoded cookies', () => {
  const request = { headers: { cookie: `${COOKIE_NAME}=%E0%A4%A` } };
  assert.equal(readDashboardSession(request), null);
});
