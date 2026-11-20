'use strict';

/**
 * Unit Tests: hashService.js
 *
 * Tests the actual computeFileHash function (SHA-256 streaming hash).
 * Uses real files — no mocks.
 *
 * SRS Coverage: FR-13 (SHA-256 duplicate detection), BR-07 (file deduplication)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');

const { computeFileHash } = require('../../../automation/backend/src/services/hashService.js');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'csvs');

function writeTempFile(content, ext = '.csv') {
  const tmpFile = path.join(os.tmpdir(), `dms-hash-test-${process.pid}-${randomUUID()}${ext}`);
  fs.writeFileSync(tmpFile, content, 'utf-8');
  return tmpFile;
}

describe('hashService — computeFileHash', () => {
  test('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await computeFileHash(path.join(FIXTURES, 'vehicle_sales_valid.csv'));
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic: same file returns same hash on repeated calls', async () => {
    const filePath = path.join(FIXTURES, 'vehicle_sales_valid.csv');
    const hash1 = await computeFileHash(filePath);
    const hash2 = await computeFileHash(filePath);
    expect(hash1).toBe(hash2);
  });

  test('different content produces different hash', async () => {
    const file1 = writeTempFile('content A');
    const file2 = writeTempFile('content B');
    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);
    expect(hash1).not.toBe(hash2);
    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
  });

  test('identical content in different files produces identical hash', async () => {
    const content = 'col1,col2\nval1,val2\n';
    const file1 = writeTempFile(content);
    const file2 = writeTempFile(content);
    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);
    expect(hash1).toBe(hash2);
    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
  });

  test('empty file has stable known SHA-256 hash', async () => {
    const emptyFile = writeTempFile('');
    const hash = await computeFileHash(emptyFile);
    // SHA-256 of empty string is well-known
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    fs.unlinkSync(emptyFile);
  });

  test('vehicle_sales_valid.csv hash is not empty', async () => {
    const hash = await computeFileHash(path.join(FIXTURES, 'vehicle_sales_valid.csv'));
    expect(hash.length).toBeGreaterThan(0);
  });

  test('service_transactions_valid.csv has different hash than vehicle_sales_valid.csv', async () => {
    const h1 = await computeFileHash(path.join(FIXTURES, 'vehicle_sales_valid.csv'));
    const h2 = await computeFileHash(path.join(FIXTURES, 'service_transactions_valid.csv'));
    expect(h1).not.toBe(h2);
  });

  test('single-byte change changes the hash', async () => {
    const content1 = 'InvoiceNo\nINV-001\n';
    const content2 = 'InvoiceNo\nINV-002\n';
    const f1 = writeTempFile(content1);
    const f2 = writeTempFile(content2);
    const h1 = await computeFileHash(f1);
    const h2 = await computeFileHash(f2);
    expect(h1).not.toBe(h2);
    fs.unlinkSync(f1);
    fs.unlinkSync(f2);
  });

  test('rejects with error for non-existent file', async () => {
    await expect(
      computeFileHash(path.join(FIXTURES, 'does_not_exist.csv'))
    ).rejects.toThrow();
  });
});
