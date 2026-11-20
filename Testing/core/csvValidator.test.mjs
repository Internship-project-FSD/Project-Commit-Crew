import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateCsvFile } from '../../automation/backend/src/services/csvValidator.js';

const config = {
  required_columns: ['InvoiceNo', 'InvoiceDate', 'SaleAmount', 'Quantity', 'CustomerName'],
  column_mapping: {
    InvoiceNo: 'invoice_no', InvoiceDate: 'invoice_date', SaleAmount: 'sale_amount',
    Quantity: 'quantity', CustomerName: 'customer_name',
  },
};
function withCsv(content, run) {
  const filename = path.join(os.tmpdir(), `dms-validator-${process.pid}-${Date.now()}-${Math.random()}.csv`);
  fs.writeFileSync(filename, content, 'utf8');
  try { return run(filename); } finally { fs.rmSync(filename, { force: true }); }
}

test('CSV validator accepts valid dates, numeric values and UTF-8 text', () => {
  const result = withCsv(
    'InvoiceNo,InvoiceDate,SaleAmount,Quantity,CustomerName\nINV-1,2026-11-01,"1,200.50",2,Zoë Motors\n',
    (filename) => validateCsvFile(filename, config),
  );
  assert.equal(result.isValid, true);
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].CustomerName, 'Zoë Motors');
});

test('CSV validator rejects invalid calendar dates and numeric formats at row level', () => {
  const result = withCsv(
    'InvoiceNo,InvoiceDate,SaleAmount,Quantity,CustomerName\nINV-1,2026-02-30,bad,2,Synthetic\n',
    (filename) => validateCsvFile(filename, config),
  );
  assert.equal(result.isValid, true);
  assert.equal(result.validRows.length, 0);
  assert.equal(result.rejectedRows.length, 1);
  assert.match(result.rejectedRows[0].reason, /InvoiceDate.*valid date/);
  assert.match(result.rejectedRows[0].reason, /SaleAmount.*valid number/);
});

test('CSV validator rejects empty files and missing required headers', () => {
  const empty = withCsv('', (filename) => validateCsvFile(filename, config));
  assert.equal(empty.isValid, false);
  assert.equal(empty.fileError, 'File is empty');
  const badHeader = withCsv('InvoiceNo,InvoiceDate\nINV-1,2026-11-01\n', (filename) => validateCsvFile(filename, config));
  assert.equal(badHeader.isValid, false);
  assert.match(badHeader.fileError, /Missing columns/);
});

test('CSV validator records original CSV row numbers for rejected records', () => {
  const result = withCsv(
    'InvoiceNo,InvoiceDate,SaleAmount,Quantity,CustomerName\nINV-1,2026-11-01,100,2,Valid\nINV-2,2026-11-01,100,2,\n',
    (filename) => validateCsvFile(filename, config),
  );
  assert.equal(result.rejectedRows[0].rowNumber, 3);
});

test('CSV validator infers odometer as an integer and rejects malformed thousands separators', () => {
  const result = withCsv(
    'InvoiceNo,Odometer,SaleAmount\nINV-1,12.5,"1,2,3"\n',
    (filename) => validateCsvFile(filename, { required_columns: ['InvoiceNo'] }),
  );
  assert.equal(result.validRows.length, 0);
  assert.equal(result.rejectedRows.length, 1);
  assert.match(result.rejectedRows[0].reason, /Odometer must be a valid integer/);
  assert.match(result.rejectedRows[0].reason, /SaleAmount must be a valid number/);
});

test('CSV validator infers camel-case date headers when no column mapping is supplied', () => {
  const result = withCsv(
    'InvoiceNo,InvoiceDate\nINV-1,2026-02-30\n',
    (filename) => validateCsvFile(filename, { required_columns: ['InvoiceNo', 'InvoiceDate'] }),
  );
  assert.equal(result.validRows.length, 0);
  assert.equal(result.rejectedRows.length, 1);
  assert.match(result.rejectedRows[0].reason, /InvoiceDate.*valid date/);
});

