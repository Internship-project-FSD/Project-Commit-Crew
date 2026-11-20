import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { computeFileHash } from '../../automation/backend/src/services/hashService.js';

test('SHA-256 service returns the standard digest for a file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-hash-'));
  const file = path.join(dir, 'file.csv');
  try {
    fs.writeFileSync(file, 'InvoiceNo,Amount\nINV-1,250.00\n', 'utf8');
    const expected = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(await computeFileHash(file), expected);
    assert.equal((await computeFileHash(file)).length, 64);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SHA-256 changes when file content changes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-hash-'));
  const file = path.join(dir, 'file.csv');
  try {
    fs.writeFileSync(file, 'one', 'utf8');
    const first = await computeFileHash(file);
    fs.writeFileSync(file, 'two', 'utf8');
    const second = await computeFileHash(file);
    assert.notEqual(first, second);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
