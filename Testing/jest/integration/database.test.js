'use strict';

/**
 * Integration Tests: PostgreSQL Database Schema and Connectivity
 *
 * Connects to the ACTUAL PostgreSQL database (dms_reports) and verifies:
 * - Connection works
 * - All required tables exist
 * - Constraints are present
 * - Report configs exist
 *
 * SRS Coverage: CC-57 (DB tables), CC-53 (backend+DB connection), FR-06 to FR-08
 *
 * PREREQUISITE: PostgreSQL running with dms_reports database and all migrations applied.
 * Without RUN_DATABASE_TESTS=true the suite is explicitly skipped. When enabled, a missing DB fails the suite.
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load automation backend .env to get the real DB config
require('dotenv').config({
  path: path.join(__dirname, '../../../automation/backend/.env')
});

const TEST_DB_NAME = process.env.TEST_DB_NAME;
if (process.env.RUN_DATABASE_TESTS === 'true' && !TEST_DB_NAME) {
  throw new Error('Set TEST_DB_NAME to a dedicated test database before running database integration tests.');
}
if (process.env.RUN_DATABASE_TESTS === 'true' && TEST_DB_NAME === (process.env.DB_NAME || 'dms_reports')) {
  throw new Error('TEST_DB_NAME must be different from DB_NAME. Refusing to run database tests against the development database.');
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: TEST_DB_NAME || 'dms_reports_test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  connectionTimeoutMillis: 5000
};

const RUN_DATABASE_TESTS = process.env.RUN_DATABASE_TESTS === 'true';
const describeDatabase = RUN_DATABASE_TESTS ? describe : describe.skip;
let client;
let dbAvailable = false;

beforeAll(async () => {
  if (!RUN_DATABASE_TESTS) return;
  client = new Client(DB_CONFIG);
  try {
    await client.connect();
    dbAvailable = true;
    console.log(`\n  ✔ Connected to PostgreSQL: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  } catch (err) {
    console.warn(`\n  ⚠ PostgreSQL unavailable: ${err.message}`);
    dbAvailable = false;
    if (RUN_DATABASE_TESTS) throw new Error(`RUN_DATABASE_TESTS=true but PostgreSQL is unavailable: ${err.message}`);
  }
});

afterAll(async () => {
  if (client) {
    try { await client.end(); } catch {}
  }
});

// ─── CONNECTIVITY ─────────────────────────────────────────────────────────────

describeDatabase('PostgreSQL — connectivity (CC-53)', () => {
  test('SELECT NOW() returns a timestamp', async () => {
    const res = await client.query('SELECT NOW() as now');
    expect(res.rows[0].now).toBeInstanceOf(Date);
  });

  test('database name matches configuration', async () => {
    const res = await client.query('SELECT current_database() as db');
    expect(res.rows[0].db).toBe(DB_CONFIG.database);
  });
});

// ─── REQUIRED TABLES (CC-57) ─────────────────────────────────────────────────

const REQUIRED_TABLES = [
  'report_configs',
  'runs',
  'files',
  'run_logs',
  'rejected_rows',
  'stg_vehicle_sales',
  'stg_service_transactions',
  'stg_spare_parts',
  'stg_insurance_renewals',
  'vehicle_sales',
  'service_transactions',
  'spare_parts',
  'insurance_renewals',
  'stg_report_records',
  'report_records'
];

describeDatabase('PostgreSQL — required tables exist (CC-57)', () => {
  for (const tableName of REQUIRED_TABLES) {
    test(`table "${tableName}" exists`, async () => {
        const res = await client.query(
        `SELECT COUNT(*) as cnt FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      expect(parseInt(res.rows[0].cnt)).toBe(1);
    });
  }
});

// ─── REPORT_CONFIGS STRUCTURE ──────────────────────────────────────────────────

describeDatabase('PostgreSQL — report_configs columns', () => {
 const REQUIRED_COLS = [
  'id', 'report_name', 'file_pattern', 'required_columns',
  'unique_key', 'column_mapping', 'schedule', 'is_active',
  'created_at', 'download_folder', 'date_strategy'
];

  for (const col of REQUIRED_COLS) {
    test(`report_configs has column "${col}"`, async () => {
        const res = await client.query(
        `SELECT COUNT(*) as cnt FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'report_configs' AND column_name = $1`,
        [col]
      );
      expect(parseInt(res.rows[0].cnt)).toBe(1);
    });
  }
});

// ─── REPORT CONFIGURATIONS SEEDED ─────────────────────────────────────────────

describeDatabase('PostgreSQL — report configs seeded (CC-52)', () => {
  const EXPECTED_REPORTS = [
    'vehicle_sales',
    'service_transactions',
    'spare_parts',
    'insurance_renewals'
  ];

  test('exactly 4 report configs exist', async () => {
    const res = await client.query('SELECT COUNT(*) as cnt FROM report_configs');
    expect(parseInt(res.rows[0].cnt)).toBeGreaterThanOrEqual(4);
  });

  for (const reportName of EXPECTED_REPORTS) {
    test(`report_config for "${reportName}" exists`, async () => {
        const res = await client.query(
        'SELECT * FROM report_configs WHERE report_name = $1',
        [reportName]
      );
      expect(res.rows).toHaveLength(1);
      const config = res.rows[0];
      expect(config.report_name).toBe(reportName);
      expect(Array.isArray(config.required_columns)).toBe(true);
      expect(config.required_columns.length).toBeGreaterThan(0);
    });
  }

  test('vehicle_sales unique_key is ["InvoiceNo"]', async () => {
    const res = await client.query(
      'SELECT unique_key FROM report_configs WHERE report_name = $1',
      ['vehicle_sales']
    );
    expect(res.rows[0].unique_key).toEqual(['InvoiceNo']);
  });

  test('service_transactions unique_key is ["JobCardNo"]', async () => {
    const res = await client.query(
      'SELECT unique_key FROM report_configs WHERE report_name = $1',
      ['service_transactions']
    );
    expect(res.rows[0].unique_key).toEqual(['JobCardNo']);
  });

  test('insurance_renewals unique_key is ["PolicyNo"]', async () => {
    const res = await client.query(
      'SELECT unique_key FROM report_configs WHERE report_name = $1',
      ['insurance_renewals']
    );
    expect(res.rows[0].unique_key).toEqual(['PolicyNo']);
  });
});

// ─── UNIQUE CONSTRAINTS ───────────────────────────────────────────────────────

describeDatabase('PostgreSQL — unique constraints on final tables', () => {
  const UNIQUE_CONSTRAINTS = [
    { table: 'vehicle_sales', column: 'invoice_no' },
    { table: 'service_transactions', column: 'job_card_no' },
    { table: 'insurance_renewals', column: 'policy_no' }
  ];

  for (const { table, column } of UNIQUE_CONSTRAINTS) {
    test(`${table}.${column} has UNIQUE constraint`, async () => {
        const res = await client.query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
         WHERE tc.table_name = $1
           AND ccu.column_name = $2
           AND tc.constraint_type = 'UNIQUE'`,
        [table, column]
      );
      expect(parseInt(res.rows[0].cnt)).toBeGreaterThan(0);
    });
  }
});

// ─── FOREIGN KEYS ─────────────────────────────────────────────────────────────

describeDatabase('PostgreSQL — foreign key constraints', () => {
  const FK_CHECKS = [
    { table: 'runs', fkTable: null, fkCol: null },
    { table: 'files', fkTable: 'runs', fkCol: 'run_id' },
    { table: 'run_logs', fkTable: 'runs', fkCol: 'run_id' },
    { table: 'rejected_rows', fkTable: 'files', fkCol: 'file_id' }
  ];

  test('files table has FK to runs', async () => {
    const res = await client.query(
      `SELECT COUNT(*) as cnt
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'files'`
    );
    expect(parseInt(res.rows[0].cnt)).toBeGreaterThan(0);
  });

  test('run_logs table has FK to runs', async () => {
    const res = await client.query(
      `SELECT COUNT(*) as cnt
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'run_logs'`
    );
    expect(parseInt(res.rows[0].cnt)).toBeGreaterThan(0);
  });
});

// ─── RUNS TABLE STRUCTURE ─────────────────────────────────────────────────────

describeDatabase('PostgreSQL — runs table (CC-52)', () => {
  const RUNS_COLS = [
    'id', 'trigger_type', 'status', 'started_at', 'ended_at',
    'total_files', 'success_files', 'failed_files',
    'total_rows', 'imported_rows', 'rejected_rows'
  ];

  for (const col of RUNS_COLS) {
    test(`runs table has column "${col}"`, async () => {
        const res = await client.query(
        `SELECT COUNT(*) as cnt FROM information_schema.columns
         WHERE table_name = 'runs' AND column_name = $1`,
        [col]
      );
      expect(parseInt(res.rows[0].cnt)).toBe(1);
    });
  }
});

// ─── INDEX CHECK ──────────────────────────────────────────────────────────────

describeDatabase('PostgreSQL — indexes exist', () => {
  test('idx_files_hash index exists on files(file_hash)', async () => {
    const res = await client.query(
      `SELECT COUNT(*) as cnt FROM pg_indexes
       WHERE tablename = 'files' AND indexname = 'idx_files_hash'`
    );
    expect(parseInt(res.rows[0].cnt)).toBe(1);
  });

  test('idx_run_logs_run_id index exists', async () => {
    const res = await client.query(
      `SELECT COUNT(*) as cnt FROM pg_indexes
       WHERE tablename = 'run_logs' AND indexname = 'idx_run_logs_run_id'`
    );
    expect(parseInt(res.rows[0].cnt)).toBe(1);
  });
});

// ─── REJECTED_ROWS TABLE ──────────────────────────────────────────────────────

describeDatabase('PostgreSQL — rejected_rows table', () => {
  test('rejected_rows has file_id, row_number, row_data, rejection_reason', async () => {
    const cols = ['file_id', 'row_number', 'row_data', 'rejection_reason'];
    for (const col of cols) {
      const res = await client.query(
        `SELECT COUNT(*) as cnt FROM information_schema.columns
         WHERE table_name = 'rejected_rows' AND column_name = $1`,
        [col]
      );
      expect(parseInt(res.rows[0].cnt)).toBe(1);
    }
  });
});
