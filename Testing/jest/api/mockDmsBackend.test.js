'use strict';

/**
 * API tests against the real Mock DMS Express app and PostgreSQL-backed session store.
 * Enable with RUN_API_TESTS=true. PostgreSQL and the mock-DMS environment are required.
 */

const path = require('path');
const request = require('supertest');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../../mock-dms/backend/.env') });
const RUN_API_TESTS = process.env.RUN_API_TESTS === 'true';
const TEST_DB_NAME = process.env.TEST_DB_NAME;
if (RUN_API_TESTS && !TEST_DB_NAME) {
  throw new Error('Set TEST_DB_NAME to a dedicated test database before running Mock DMS API tests.');
}
if (RUN_API_TESTS && TEST_DB_NAME === (process.env.DB_NAME || 'dms_reports')) {
  throw new Error('TEST_DB_NAME must be different from DB_NAME. Refusing to run Mock DMS API tests against the development database.');
}
if (RUN_API_TESTS) process.env.DB_NAME = TEST_DB_NAME;
const describeApi = RUN_API_TESTS ? describe : describe.skip;

let app;
let pool;

beforeAll(async () => {
  if (!RUN_API_TESTS) return;
  const appModule = require('../../../mock-dms/backend/app.js');
  app = appModule.app;
  pool = appModule.pool;
  await pool.query('SELECT 1');
  const database = require('../../../mock-dms/backend/config/database.js');
  await database.initializeDatabase();
}, 30000);

afterAll(async () => {
  if (pool) await pool.end().catch(() => {});
});

describeApi('Mock DMS API — health and authentication (FR-01, FR-06)', () => {
  test('health endpoint confirms PostgreSQL connectivity', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });

  test('login rejects missing credentials with HTTP 400', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'test@example.invalid' });
    expect(response.status).toBe(400);
  });

  test('login rejects an unknown account/password pair', async () => {
    const response = await request(app).post('/api/auth/login').send({
      username: 'unknown-test-user', password: 'definitely-not-the-password',
    });
    expect(response.status).toBe(401);
  });

  test('automation login rejects a wrong secret', async () => {
    const response = await request(app).post('/api/auth/automation-login')
      .set('x-automation-secret', 'incorrect-test-secret')
      .send({ username: 'automation', password: 'incorrect-test-password' });
    expect(response.status).toBe(401);
  });
});

describeApi('Mock DMS API — authenticated report protection (FR-02, FR-03)', () => {
  test('report listing requires an authenticated session', async () => {
    const response = await request(app).get('/api/reports');
    expect(response.status).toBe(401);
  });

  test('report preview requires an authenticated session', async () => {
    const response = await request(app).get('/api/reports/vehicle-sales-purchases')
      .query({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(response.status).toBe(401);
  });

  test('CSV download requires an authenticated session', async () => {
    const response = await request(app).get('/api/reports/vehicle-sales-purchases/download')
      .query({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(response.status).toBe(401);
  });
});
