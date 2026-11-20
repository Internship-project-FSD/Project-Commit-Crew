import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createConfiguredRow,
  applyConfiguredScenario,
  getReportData,
} = require('../../mock-dms/backend/services/report.service.js');

test('Mock DMS generates a synthetic row from an arbitrary report configuration', () => {
  const config = { report_name: 'fleet_inspections', unique_key: ['InspectionId'] };
  const columns = ['InspectionId', 'InspectionDate', 'Odometer', 'InspectionCost', 'Status', 'Email'];
  const row = createConfiguredRow(config, columns, 0, '2026-11-01', '2026-11-05');
  assert.equal(row.InspectionId, 'FLEETINS-000001');
  assert.match(row.InspectionDate, /^2026-11-0[1-5]$/);
  assert.equal(typeof row.Odometer, 'number');
  assert.equal(typeof row.InspectionCost, 'number');
  assert.equal(row.Status, 'PENDING');
  assert.match(row.Email, /@example\.invalid$/);
});

test('Mock DMS can simulate duplicate rows for a configured report', () => {
  const rows = [{ id: 'one' }, { id: 'two' }];
  const result = applyConfiguredScenario(rows, ['id'], 'duplicates');
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows[2], rows[0]);
});

test('Mock DMS can simulate a download timeout for a seeded report', () => {
  const result = getReportData('vehicle-sales-purchases', {
    startDate: '2026-11-01', endDate: '2026-11-01', scenario: 'timeout',
  });
  assert.equal(result.status, 504);
  assert.match(result.error, /timeout/i);
});

test('Mock DMS rejects invalid report date ranges', () => {
  const result = getReportData('vehicle-sales-purchases', {
    startDate: '2026-11-08', endDate: '2026-11-01',
  });
  assert.equal(result.status, 400);
});
