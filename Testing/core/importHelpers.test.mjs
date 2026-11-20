import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  assertSafeIdentifier, mapCsvRows, buildBulkInsert, selectReportConfigs,
  calculateRunStatus, stableUniqueKeyHash,
} from '../../automation/backend/src/services/importHelpers.js';

test('import helpers reject unsafe SQL identifiers', () => {
  assert.equal(assertSafeIdentifier('report_records'), 'report_records');
  assert.throws(() => assertSafeIdentifier('report; DROP TABLE runs'), /Invalid/);
});

test('mapCsvRows maps configured fields and keeps source traceability', () => {
  const mapped = mapCsvRows(
    [{ InvoiceNo: 'INV-01', SaleAmount: '', CustomerName: 'Synthetic' }],
    { InvoiceNo: 'invoice_no', SaleAmount: 'sale_amount', CustomerName: 'customer_name' },
    11, 23,
  );
  assert.deepEqual(mapped, [{ file_id: 11, run_id: 23, invoice_no: 'INV-01', sale_amount: null, customer_name: 'Synthetic' }]);
});

test('buildBulkInsert creates valid batches and sequential placeholders', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ file_id: index + 1, run_id: 42 }));
  const statements = buildBulkInsert('stg_vehicle_sales', rows, 2);
  assert.equal(statements.length, 3);
  assert.equal(statements[0].rowCount, 2);
  assert.deepEqual(statements[0].values, [1, 42, 2, 42]);
  assert.match(statements[0].text, /\$1, \$2\), \(\$3, \$4/);
});

test('report config selector supports all, database ID, portal path and report name', () => {
  const configs = [
    { id: 1, portal_path: 'vehicle-sales-purchases', report_name: 'vehicle_sales' },
    { id: 2, portal_path: 'service-transactions', report_name: 'service_transactions' },
  ];
  assert.equal(selectReportConfigs(configs, 'all').length, 2);
  assert.equal(selectReportConfigs(configs, '2')[0].report_name, 'service_transactions');
  assert.equal(selectReportConfigs(configs, 'vehicle-sales-purchases')[0].id, 1);
  assert.equal(selectReportConfigs(configs, 'vehicle_sales')[0].id, 1);
  assert.throws(() => selectReportConfigs(configs, 'unknown'), /No active report/);
});

test('run status reflects success, partial and fatal failure states', () => {
  assert.equal(calculateRunStatus({ successFiles: 2, failedFiles: 0 }), 'success');
  assert.equal(calculateRunStatus({ successFiles: 1, failedFiles: 1 }), 'partial');
  assert.equal(calculateRunStatus({ successFiles: 0, failedFiles: 1 }), 'failed');
});

test('unique key hashes are stable and reject empty key values', () => {
  const first = stableUniqueKeyHash({ InvoiceNo: 'INV-01' }, ['InvoiceNo'], createHash);
  const again = stableUniqueKeyHash({ InvoiceNo: 'INV-01' }, ['InvoiceNo'], createHash);
  assert.equal(first, again);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.throws(() => stableUniqueKeyHash({ InvoiceNo: '' }, ['InvoiceNo'], createHash), /missing/);
});
