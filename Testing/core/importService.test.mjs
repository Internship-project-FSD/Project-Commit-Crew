import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processFile } from '../../automation/backend/src/services/importService.js';

// Convert file URLs with fileURLToPath so Windows drive letters are not
// treated as an extra path segment (which would produce C:\C:\...).
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const incomingDir = path.join(projectRoot, 'downloads', 'incoming');
const processedDir = path.join(projectRoot, 'downloads', 'processed');
const failedDir = path.join(projectRoot, 'downloads', 'failed');
const config = {
  id: 1,
  report_name: 'vehicle_sales',
  required_columns: ['InvoiceNo', 'InvoiceDate', 'SaleAmount'],
  unique_key: ['InvoiceNo'],
  column_mapping: { InvoiceNo: 'invoice_no', InvoiceDate: 'invoice_date', SaleAmount: 'sale_amount' },
};

function fixtureFile(label) {
  fs.mkdirSync(incomingDir, { recursive: true });
  const file = path.join(incomingDir, `vehicle_sales_core_${process.pid}_${Date.now()}_${label}.csv`);
  fs.writeFileSync(file, 'InvoiceNo,InvoiceDate,SaleAmount\nINV-CORE,2026-11-01,100.00\n', 'utf8');
  return file;
}

function fakeServices({ duplicate = false, failFinalInsert = false } = {}) {
  const calls = [];
  const statuses = [];
  let released = false;
  const client = {
    async query(sql, values) {
      calls.push({ sql: String(sql), values });
      if (failFinalInsert && String(sql).includes('INSERT INTO vehicle_sales')) throw new Error('forced final insert failure');
      if (String(sql).includes('INSERT INTO vehicle_sales')) return { rowCount: 1, rows: [{ id: 55 }] };
      return { rowCount: 0, rows: [] };
    },
    release() { released = true; },
  };
  const services = {
    logger: {
      async info() {}, async warn() {}, async error() {},
    },
    computeFileHash: async () => 'a'.repeat(64),
    isFileAlreadyProcessed: async () => duplicate,
    createFileRecord: async (runId, configId, fileName, hash, metadata) => ({
      id: 77, run_id: runId, report_config_id: configId, file_name: fileName, file_hash: hash, ...metadata,
    }),
    updateFileStatus: async (id, status, stats, error) => statuses.push({ id, status, stats, error }),
    validateCsvFile: () => ({
      isValid: true,
      totalRows: 2,
      validRows: [{ InvoiceNo: 'INV-CORE', InvoiceDate: '2026-11-01', SaleAmount: '100.00' }],
      rejectedRows: [{ rowNumber: 3, data: { InvoiceNo: '', SaleAmount: '10' }, reason: 'InvoiceNo is empty' }],
    }),
    db: { async getClient() { return client; } },
  };
  return { services, calls, statuses, wasReleased: () => released };
}

function removeMovedFile(filePath) {
  const name = path.basename(filePath);
  for (const dir of [processedDir, failedDir]) fs.rmSync(path.join(dir, name), { force: true });
}

test('processFile uses the real production import path, bulk staging and transaction commit', async () => {
  const file = fixtureFile('success');
  const fake = fakeServices();
  try {
    const result = await processFile(12, file, config, { services: fake.services });
    assert.equal(result.status, 'success');
    assert.equal(result.importedRows, 1);
    assert.equal(result.rejectedRows, 1);
    assert.ok(fake.calls.some((call) => call.sql.includes('BEGIN')));
    assert.ok(fake.calls.some((call) => call.sql.includes('INSERT INTO stg_vehicle_sales')));
    assert.ok(fake.calls.some((call) => call.sql.includes('INSERT INTO vehicle_sales')));
    assert.ok(fake.calls.some((call) => call.sql.includes('INSERT INTO rejected_rows')));
    assert.ok(fake.calls.some((call) => call.sql.includes('COMMIT')));
    assert.equal(fake.wasReleased(), true);
  } finally { removeMovedFile(file); }
});

test('processFile rolls back a database failure and records a failed file', async () => {
  const file = fixtureFile('rollback');
  const fake = fakeServices({ failFinalInsert: true });
  try {
    const result = await processFile(13, file, config, { services: fake.services });
    assert.equal(result.status, 'failed');
    assert.match(result.error, /forced final insert failure/);
    assert.ok(fake.calls.some((call) => call.sql.includes('ROLLBACK')));
    assert.equal(fake.calls.some((call) => call.sql.includes('COMMIT')), false);
    assert.equal(fake.statuses.at(-1).status, 'failed');
    assert.equal(fake.wasReleased(), true);
  } finally { removeMovedFile(file); }
});

test('processFile recognizes duplicate file hashes and skips database writes', async () => {
  const file = fixtureFile('duplicate');
  const fake = fakeServices({ duplicate: true });
  try {
    const result = await processFile(14, file, config, { services: fake.services });
    assert.equal(result.status, 'duplicate');
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.statuses.at(-1).status, 'duplicate');
  } finally { removeMovedFile(file); }
});

test('processFile forceReprocess bypasses file-hash skipping', async () => {
  const file = fixtureFile('force');
  const fake = fakeServices({ duplicate: true });
  try {
    const result = await processFile(15, file, config, { forceReprocess: true, services: fake.services });
    assert.equal(result.status, 'success');
    assert.ok(fake.calls.some((call) => call.sql.includes('BEGIN')));
  } finally { removeMovedFile(file); }
});
