'use strict';

/**
 * API integration tests against the real automation Express app.
 * Requires PostgreSQL and dashboard Admin/Manager credentials in automation/backend/.env.
 * Enable explicitly with RUN_API_TESTS=true. Missing prerequisites fail the suite.
 */

import path from 'node:path';
import request from 'supertest';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../../automation/backend/.env') });
const RUN_API_TESTS = process.env.RUN_API_TESTS === 'true';
const TEST_DB_NAME = process.env.TEST_DB_NAME;
if (RUN_API_TESTS && !TEST_DB_NAME) {
  throw new Error('Set TEST_DB_NAME to a dedicated test database before running API integration tests.');
}
if (RUN_API_TESTS && TEST_DB_NAME === (process.env.DB_NAME || 'dms_reports')) {
  throw new Error('TEST_DB_NAME must be different from DB_NAME. Refusing to run API tests against the development database.');
}
if (RUN_API_TESTS) process.env.DB_NAME = TEST_DB_NAME;
const describeApi = RUN_API_TESTS ? describe : describe.skip;

let app;
let pool;
let adminAgent;
let managerAgent;

beforeAll(async () => {
  if (!RUN_API_TESTS) return;
  if (!process.env.DASHBOARD_ADMIN_EMAIL || !process.env.RUN_API_ADMIN_PASSWORD ||
      !process.env.DASHBOARD_MANAGER_EMAIL || !process.env.RUN_API_MANAGER_PASSWORD) {
    throw new Error('API tests require dashboard Admin/Manager emails in automation/backend/.env plus RUN_API_ADMIN_PASSWORD and RUN_API_MANAGER_PASSWORD for this test session.');
  }
  const appModule = await import('../../../automation/backend/src/app.js');
  app = appModule.default || appModule.app || appModule;
  const dbModule = await import('../../../automation/backend/src/config/db.js');
  pool = dbModule.pool;
  await pool.query('SELECT 1');

  adminAgent = request.agent(app);
  const adminLogin = await adminAgent.post('/api/auth/login').send({
    email: process.env.DASHBOARD_ADMIN_EMAIL,
    password: process.env.RUN_API_ADMIN_PASSWORD,
  });
  if (adminLogin.status !== 200) throw new Error(`Admin test login failed (${adminLogin.status}): ${JSON.stringify(adminLogin.body)}`);

  managerAgent = request.agent(app);
  const managerLogin = await managerAgent.post('/api/auth/login').send({
    email: process.env.DASHBOARD_MANAGER_EMAIL,
    password: process.env.RUN_API_MANAGER_PASSWORD,
  });
  if (managerLogin.status !== 200) throw new Error(`Manager test login failed (${managerLogin.status}): ${JSON.stringify(managerLogin.body)}`);
}, 30000);

afterAll(async () => {
  if (pool) await pool.end().catch(() => {});
});

describeApi('Automation API â€” health and session (FR-24, NFR-01)', () => {
  test('health endpoint reports the application and database status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('database.connected', true);
    expect(response.body).toHaveProperty('automation.ready', true);
  });

  test('Admin session identifies the authenticated Admin role', async () => {
    const response = await adminAgent.get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('admin');
  });

  test('Manager session identifies the authenticated Manager role', async () => {
    const response = await managerAgent.get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('manager');
  });

  test('unauthenticated report and run endpoints reject access', async () => {
    expect((await request(app).get('/api/reports')).status).toBe(401);
    expect((await request(app).get('/api/runs')).status).toBe(401);
  });
});

describeApi('Automation API â€” Admin and Manager permissions (SRS user classes)', () => {
  test('Admin can read configured reports', async () => {
    const response = await adminAgent.get('/api/reports');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('Manager cannot trigger a manual run', async () => {
    const response = await managerAgent.post('/api/runs/start').send({
      dateRange: { startDate: '2026-11-01', endDate: '2026-11-01' },
    });
    expect(response.status).toBe(403);
  });

  test('Manager cannot create report configuration', async () => {
    const response = await managerAgent.post('/api/reports').send({});
    expect(response.status).toBe(403);
  });

  test('Manager cannot edit report configuration', async () => {
    const response = await managerAgent.put('/api/reports/1').send({});
    expect(response.status).toBe(403);
  });

  test('Admin receives validation errors for an invalid configuration update', async () => {
    const response = await adminAgent.put('/api/reports/1').send({
      download_folder: 'downloads/incoming',
      date_strategy: 'not-a-strategy',
      schedule_cron: 'not-cron',
      required_columns: ['InvoiceNo'],
      unique_key: ['InvoiceNo'],
      column_mapping: { InvoiceNo: 'invoice_no' },
      is_enabled: true,
    });
    expect(response.status).toBe(400);
  });
});

describeApi('Automation API â€” run history and errors (FR-24, FR-25, FR-27)', () => {
  test('Admin can retrieve run history', async () => {
    const response = await adminAgent.get('/api/runs?limit=5');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('unknown API route returns 404', async () => {
    expect((await adminAgent.get('/api/not-a-real-route')).status).toBe(404);
  });
});



