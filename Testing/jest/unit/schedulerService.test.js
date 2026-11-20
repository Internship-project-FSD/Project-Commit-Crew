'use strict';

/**
 * Unit Tests: schedulerService.js — getDateRange()
 *
 * Tests the exported getDateRange function without mocking node-cron or pg.
 * We import just the named export from the ESM module (transpiled by babel-jest).
 *
 * SRS Coverage: FR-19 (date strategies), FR-20 (scheduler), BR-09 (timezone)
 */

const { getDateRange } = require('../../../automation/backend/src/services/dateRange.js');

const TIMEZONE = 'Asia/Kolkata';

// Helper: get today's date in IST using same logic as the production code
function getISTToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const dp = {};
  for (const p of parts) dp[p.type] = p.value;
  return new Date(Date.UTC(Number(dp.year), Number(dp.month) - 1, Number(dp.day)));
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

describe('schedulerService — getDateRange()', () => {
  test('"yesterday" returns endDate = yesterday, startDate = yesterday', () => {
    const result = getDateRange('yesterday');

    expect(result).toHaveProperty('startDate');
    expect(result).toHaveProperty('endDate');
    expect(result.startDate).toBe(result.endDate);

    const todayIST = getISTToday();
    const expectedEnd = new Date(todayIST);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
    expect(result.endDate).toBe(formatDate(expectedEnd));
  });

  test('"last_7_days" returns 7-day range ending yesterday', () => {
    const result = getDateRange('last_7_days');

    const todayIST = getISTToday();
    const expectedEnd = new Date(todayIST);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
    const expectedStart = new Date(expectedEnd);
    expectedStart.setUTCDate(expectedStart.getUTCDate() - 6); // 7 days inclusive

    expect(result.endDate).toBe(formatDate(expectedEnd));
    expect(result.startDate).toBe(formatDate(expectedStart));
  });

  test('"last_30_days" returns 30-day range ending yesterday', () => {
    const result = getDateRange('last_30_days');

    const todayIST = getISTToday();
    const expectedEnd = new Date(todayIST);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() - 1);
    const expectedStart = new Date(expectedEnd);
    expectedStart.setUTCDate(expectedStart.getUTCDate() - 29); // 30 days inclusive

    expect(result.endDate).toBe(formatDate(expectedEnd));
    expect(result.startDate).toBe(formatDate(expectedStart));
  });

  test('"fixed" strategy returns its configured date range', () => {
    expect(getDateRange('fixed', '2026-10-01', '2026-10-05')).toEqual({
      startDate: '2026-10-01', endDate: '2026-10-05'
    });
  });

  test('fixed strategy rejects missing or reversed dates', () => {
    expect(() => getDateRange('fixed')).toThrow(/valid fixed_start_date/i);
    expect(() => getDateRange('fixed', '2026-10-05', '2026-10-01')).toThrow(/valid fixed_start_date/i);
  });

  test('unknown strategy throws an error', () => {
    expect(() => getDateRange('monthly')).toThrow(/Unsupported date strategy/i);
  });

  test('empty string strategy throws an error', () => {
    expect(() => getDateRange('')).toThrow();
  });

  test('null strategy throws an error', () => {
    expect(() => getDateRange(null)).toThrow();
  });

  test('startDate and endDate are valid ISO date strings (YYYY-MM-DD)', () => {
    const result = getDateRange('yesterday');
    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('startDate <= endDate for all valid strategies', () => {
    for (const strategy of ['yesterday', 'last_7_days', 'last_30_days']) {
      const result = getDateRange(strategy);
      expect(result.startDate <= result.endDate).toBe(true);
    }
  });

  test('TIMEZONE constant is Asia/Kolkata (verified in source)', () => {
    // We verify the source file contains the correct timezone constant
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../../automation/backend/src/services/schedulerService.js'),
      'utf-8'
    );
    expect(src).toContain("'Asia/Kolkata'");
  });

  test('node-cron is used for scheduling (verified in source)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../../automation/backend/src/services/schedulerService.js'),
      'utf-8'
    );
    expect(src).toContain("import cron from 'node-cron'");
  });

  test('"last_7_days" range spans exactly 7 calendar days', () => {
    const result = getDateRange('last_7_days');
    const start = new Date(result.startDate);
    const end = new Date(result.endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6); // 7 inclusive = 6 day gap
  });

  test('"last_30_days" range spans exactly 30 calendar days', () => {
    const result = getDateRange('last_30_days');
    const start = new Date(result.startDate);
    const end = new Date(result.endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(29); // 30 inclusive = 29 day gap
  });
});
