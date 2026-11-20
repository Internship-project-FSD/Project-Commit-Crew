import test from 'node:test';
import assert from 'node:assert/strict';
import { getDateRange } from '../../automation/backend/src/services/dateRange.js';

test('fixed date strategy uses the configured dates', () => {
  assert.deepEqual(getDateRange('fixed', '2026-10-01', '2026-10-04'), {
    startDate: '2026-10-01', endDate: '2026-10-04',
  });
});

test('fixed date strategy rejects missing, invalid and reversed dates', () => {
  assert.throws(() => getDateRange('fixed'), /valid fixed_start_date/);
  assert.throws(() => getDateRange('fixed', '2026-02-30', '2026-03-01'), /valid fixed_start_date/);
  assert.throws(() => getDateRange('fixed', '2026-10-04', '2026-10-01'), /valid fixed_start_date/);
});

test('relative date strategies produce inclusive windows ending yesterday in IST', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  const sevenDays = getDateRange('last_7_days', null, null, now);
  const start = new Date(`${sevenDays.startDate}T00:00:00Z`);
  const end = new Date(`${sevenDays.endDate}T00:00:00Z`);
  assert.equal((end - start) / 86400000, 6);
  assert.ok(sevenDays.endDate < '2026-11-18');
});

