'use strict';

/**
 * Integration Tests: Run History (CC-52)
 *
 * Tests actual run lifecycle: startRun → endRun → getRuns → getRunById
 * Uses the REAL PostgreSQL dms_reports database via the production DB module.
 *
 * Uses a separate test run so it doesn't pollute real data —
 * all test runs are created with trigger_type='manual' and cleaned up after.
 *
 * SRS Coverage: CC-52 (run history), FR-21 (run logging), FR-22 (run stats)
 *
 * PREREQUISITE: PostgreSQL running with a dedicated TEST_DB_NAME database and migrations applied.
 */

const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../../../automation/backend/.env')
});

// Set up DB environment before importing the actual modules
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'dms_reports';

const RUN_DATABASE_TESTS = process.env.RUN_DATABASE_TESTS === 'true';
const TEST_DB_NAME = process.env.TEST_DB_NAME;
if (RUN_DATABASE_TESTS && !TEST_DB_NAME) {
  throw new Error('Set TEST_DB_NAME to a dedicated test database before running run-history integration tests.');
}
if (RUN_DATABASE_TESTS && TEST_DB_NAME === (process.env.DB_NAME || 'dms_reports')) {
  throw new Error('TEST_DB_NAME must be different from DB_NAME. Refusing to run run-history tests against the development database.');
}
if (RUN_DATABASE_TESTS) process.env.DB_NAME = TEST_DB_NAME;
const describeDatabase = RUN_DATABASE_TESTS ? describe : describe.skip;
let db, startRun, endRun, getRuns, getRunById;
let dbAvailable = false;
let testRunId = null;

beforeAll(async () => {
  if (!RUN_DATABASE_TESTS) return;
  try {
    db = require('../../../automation/backend/src/config/db.js');
    const runService = require('../../../automation/backend/src/services/runService.js');
    startRun = runService.startRun;
    endRun = runService.endRun;
    getRuns = runService.getRuns;
    getRunById = runService.getRunById;

    // Test connection
    await db.query('SELECT 1');
    dbAvailable = true;
    console.log('\n  ✔ DB connected for run history tests');
  } catch (err) {
    if (RUN_DATABASE_TESTS) throw new Error(`RUN_DATABASE_TESTS=true but PostgreSQL is unavailable: ${err.message}`);
  }
});

afterAll(async () => {
  // Clean up test runs
  if (dbAvailable && testRunId) {
    try {
      await db.query('DELETE FROM run_logs WHERE run_id = $1', [testRunId]);
      await db.query('DELETE FROM runs WHERE id = $1 AND trigger_type = $2', [testRunId, 'manual']);
    } catch {}
  }
  if (db && db.pool) {
    try { await db.pool.end(); } catch {}
  }
});

// ─── STARTRUN ─────────────────────────────────────────────────────────────────

describeDatabase('runService — startRun() (CC-52)', () => {
  test('creates a run record with status=running', async () => {
    const run = await startRun('manual');
    expect(run).toBeDefined();
    expect(run.id).toBeGreaterThan(0);
    expect(run.trigger_type).toBe('manual');
    expect(run.status).toBe('running');
    expect(run.started_at).toBeInstanceOf(Date);
    testRunId = run.id;
  });

  test('trigger_type is stored correctly', async () => {
    const result = await db.query(
      'SELECT trigger_type FROM runs WHERE id = $1',
      [testRunId]
    );
    expect(result.rows[0].trigger_type).toBe('manual');
  });
});

// ─── ENDRUN ───────────────────────────────────────────────────────────────────

describeDatabase('runService — endRun() (CC-52)', () => {
  test('updates run to success with correct stats', async () => {
    if (!testRunId) throw new Error("The test run was not created by the preceding setup test.");

    const stats = {
      totalFiles: 2,
      successFiles: 1,
      failedFiles: 1,
      totalRows: 10,
      importedRows: 8,
      rejectedRows: 2
    };

    const updated = await endRun(testRunId, 'success', stats);
    expect(updated.status).toBe('success');
    expect(updated.total_files).toBe(2);
    expect(updated.success_files).toBe(1);
    expect(updated.failed_files).toBe(1);
    expect(updated.total_rows).toBe(10);
    expect(updated.imported_rows).toBe(8);
    expect(updated.rejected_rows).toBe(2);
    expect(updated.ended_at).toBeInstanceOf(Date);
  });
});

// ─── GETRUNS ──────────────────────────────────────────────────────────────────

describeDatabase('runService — getRuns() (CC-52)', () => {
  test('returns an array of runs', async () => {
    const runs = await getRuns(10, 0);
    expect(Array.isArray(runs)).toBe(true);
  });

  test('each run has id, status, trigger_type, files array', async () => {
    const runs = await getRuns(5, 0);
    if (runs.length > 0) {
      const run = runs[0];
      expect(run).toHaveProperty('id');
      expect(run).toHaveProperty('status');
      expect(run).toHaveProperty('trigger_type');
      expect(run).toHaveProperty('files');
      expect(Array.isArray(run.files)).toBe(true);
    }
  });

  test('respects limit parameter', async () => {
    const runs = await getRuns(2, 0);
    expect(runs.length).toBeLessThanOrEqual(2);
  });
});

// ─── GETRUNBYID ───────────────────────────────────────────────────────────────

describeDatabase('runService — getRunById() (CC-52)', () => {
  test('returns run with files and logs for existing runId', async () => {
    if (!testRunId) throw new Error("The test run was not created by the preceding setup test.");
    const run = await getRunById(testRunId);
    expect(run).not.toBeNull();
    expect(run.id).toBe(testRunId);
    expect(Array.isArray(run.files)).toBe(true);
    expect(Array.isArray(run.logs)).toBe(true);
  });

  test('returns null for non-existent runId', async () => {
    const run = await getRunById(999999999);
    expect(run).toBeNull();
  });
});

// ─── RUN STATUS CONSTRAINT ────────────────────────────────────────────────────

describeDatabase('runService — DB constraint: valid status values', () => {
  test('inserting invalid status fails', async () => {
    await expect(
      db.query(
        "INSERT INTO runs (trigger_type, status) VALUES ('manual', 'invalid_status')"
      )
    ).rejects.toThrow();
  });

  test('inserting invalid trigger_type fails', async () => {
    await expect(
      db.query(
        "INSERT INTO runs (trigger_type) VALUES ('ftp')"
      )
    ).rejects.toThrow();
  });
});
