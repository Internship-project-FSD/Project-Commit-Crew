'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const {
  authenticateDashboardUser, setDashboardSession, readDashboardSession,
  signPayload, COOKIE_NAME,
} = require('../../../automation/backend/src/services/dashboardAuthService.js');
const scrypt = promisify(crypto.scrypt);

async function makeHash(password, saltText = 'unit-test-salt') {
  const salt = Buffer.from(saltText);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

beforeAll(async () => {
  process.env.DASHBOARD_SESSION_SECRET = 'unit-test-dashboard-session-secret-at-least-32-chars';
  process.env.DASHBOARD_ADMIN_EMAIL = 'admin@example.test';
  process.env.DASHBOARD_ADMIN_NAME = 'Test Admin';
  process.env.DASHBOARD_ADMIN_PASSWORD_HASH = await makeHash('admin-password-123');
  process.env.DASHBOARD_MANAGER_EMAIL = 'manager@example.test';
  process.env.DASHBOARD_MANAGER_NAME = 'Test Manager';
  process.env.DASHBOARD_MANAGER_PASSWORD_HASH = await makeHash('manager-password-123', 'manager-test-salt');
});

afterAll(() => {
  for (const key of [
    'DASHBOARD_SESSION_SECRET', 'DASHBOARD_ADMIN_EMAIL', 'DASHBOARD_ADMIN_NAME',
    'DASHBOARD_ADMIN_PASSWORD_HASH', 'DASHBOARD_MANAGER_EMAIL', 'DASHBOARD_MANAGER_NAME',
    'DASHBOARD_MANAGER_PASSWORD_HASH',
  ]) delete process.env[key];
});

describe('dashboardAuthService — Admin and Manager authentication', () => {
  test('authenticates the configured Admin account', async () => {
    const user = await authenticateDashboardUser('admin@example.test', 'admin-password-123');
    expect(user).toMatchObject({ role: 'admin', email: 'admin@example.test', name: 'Test Admin' });
  });

  test('authenticates the configured Manager account', async () => {
    const user = await authenticateDashboardUser('manager@example.test', 'manager-password-123');
    expect(user).toMatchObject({ role: 'manager', email: 'manager@example.test', name: 'Test Manager' });
  });

  test('rejects an incorrect password and unknown email', async () => {
    await expect(authenticateDashboardUser('admin@example.test', 'wrong-password')).resolves.toBeNull();
    await expect(authenticateDashboardUser('unknown@example.test', 'admin-password-123')).resolves.toBeNull();
  });

  test('sets a signed HttpOnly cookie and reads its user role', async () => {
    const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
    setDashboardSession(response, { id: 'admin', role: 'admin', name: 'Test Admin', email: 'admin@example.test' });
    const cookie = response.headers['Set-Cookie'];
    expect(cookie).toContain(`${COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    const request = { headers: { cookie: cookie.split(';')[0] } };
    expect(readDashboardSession(request)).toMatchObject({ role: 'admin', email: 'admin@example.test' });
  });

  test('rejects a tampered or expired signed session', () => {
    const valid = signPayload({ role: 'admin', name: 'Test Admin', email: 'admin@example.test', exp: 1 });
    const request = { headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(valid)}` } };
    expect(readDashboardSession(request)).toBeNull();
    const tampered = `${valid.slice(0, -1)}x`;
    expect(readDashboardSession({ headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(tampered)}` } })).toBeNull();
  });
});

test('rejects malformed URL-encoded cookie data without throwing', () => {
  const request = { headers: { cookie: `${COOKIE_NAME}=%E0%A4%A` } };
  expect(readDashboardSession(request)).toBeNull();
});
