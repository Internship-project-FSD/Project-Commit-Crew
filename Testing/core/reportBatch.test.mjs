import test from 'node:test';
import assert from 'node:assert/strict';
import { processReportsIndividually, extractAutomationSummary, logAutomationFailures } from '../../automation/backend/src/services/reportBatch.js';

test('report batch keeps processing after one report fails', async () => {
  const visited = [];
  const summary = await processReportsIndividually([
    { id: 'sales', name: 'Sales' }, { id: 'service', name: 'Service' }, { id: 'parts', name: 'Parts' },
  ], async (report) => {
    visited.push(report.id);
    if (report.id === 'service') throw new Error('simulated download timeout');
    return `${report.id}-ok`;
  });
  assert.deepEqual(visited, ['sales', 'service', 'parts']);
  assert.equal(summary.status, 'partial');
  assert.equal(summary.successCount, 2);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.results[1].status, 'failed');
});

test('automation summary parser reads the structured result marker', () => {
  const payload = { status: 'partial', totalReports: 2, results: [{ status: 'failed' }] };
  const parsed = extractAutomationSummary(`noise\nDMS_AUTOMATION_RESULT=${JSON.stringify(payload)}\nmore noise`);
  assert.deepEqual(parsed, payload);
  assert.equal(extractAutomationSummary('no structured marker'), null);
});

test('download failures are logged with report identity', async () => {
  const recorded = [];
  const count = await logAutomationFailures(99, {
    results: [
      { reportId: 'parts', reportName: 'Spare Parts', status: 'failed', error: 'timeout' },
      { reportId: 'sales', status: 'success' },
    ],
  }, { error: async (...args) => recorded.push(args) });
  assert.equal(count, 1);
  assert.equal(recorded[0][0], 99);
  assert.match(recorded[0][1], /Spare Parts.*timeout/);
  assert.equal(recorded[0][2].reportId, 'parts');
});
