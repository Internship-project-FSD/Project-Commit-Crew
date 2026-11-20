'use strict';

/**
 * Unit Tests: mock-dms report.service.js
 *
 * Tests the actual report generation logic from the Mock DMS backend.
 * This is CommonJS — no Babel transformation needed.
 *
 * SRS Coverage: FR-01 (DMS reports), FR-02 to FR-05 (four report types),
 *               CC-48 (mock DMS scenarios), CC-47 (invalid scenarios)
 */

const { reports, getReportData, createConfiguredRow } = require('../../../mock-dms/backend/services/report.service.js');

const START = '2024-01-01';
const END = '2024-01-07';

// ─── LIST REPORTS ─────────────────────────────────────────────────────────────

describe('reportService — reports array', () => {
  test('exports exactly 4 reports', () => {
    expect(Array.isArray(reports)).toBe(true);
    expect(reports).toHaveLength(4);
  });

  test('each report has id, name, columns', () => {
    for (const r of reports) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(Array.isArray(r.columns)).toBe(true);
      expect(r.columns.length).toBeGreaterThan(0);
    }
  });

  test('contains vehicle-sales-purchases', () => {
    expect(reports.map(r => r.id)).toContain('vehicle-sales-purchases');
  });

  test('contains service-transactions', () => {
    expect(reports.map(r => r.id)).toContain('service-transactions');
  });

  test('contains spare-parts-sales-purchases', () => {
    expect(reports.map(r => r.id)).toContain('spare-parts-sales-purchases');
  });

  test('contains insurance-renewals', () => {
    expect(reports.map(r => r.id)).toContain('insurance-renewals');
  });
});

// ─── NORMAL SCENARIO ──────────────────────────────────────────────────────────

describe('reportService — getReportData() normal scenario', () => {
  test('vehicle-sales normal: returns rows with InvoiceNo', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.rows)).toBe(true);
    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.rows[0]).toHaveProperty('InvoiceNo');
  });

  test('service-transactions normal: returns rows with JobCardNo', () => {
    const result = getReportData('service-transactions', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.rows[0]).toHaveProperty('JobCardNo');
  });

  test('spare-parts normal: returns rows with PartNo', () => {
    const result = getReportData('spare-parts-sales-purchases', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.rows[0]).toHaveProperty('PartNo');
  });

  test('insurance-renewals normal: returns rows with PolicyNo', () => {
    const result = getReportData('insurance-renewals', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.rows[0]).toHaveProperty('PolicyNo');
  });

  test('vehicle-sales columns match expected set', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    const row = result.data.rows[0];
    const expectedCols = [
      'InvoiceNo', 'InvoiceDate', 'CustomerName', 'VehicleModel',
      'Variant', 'Color', 'ChassisNo', 'EngineNo', 'SaleAmount',
      'TaxAmount', 'TotalAmount', 'PaymentMode', 'Salesperson'
    ];
    for (const col of expectedCols) {
      expect(row).toHaveProperty(col);
    }
  });

  test('result.data.report contains id, name, columns', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    expect(result.data.report).toHaveProperty('id', 'vehicle-sales-purchases');
    expect(result.data.report).toHaveProperty('name');
    expect(result.data.report).toHaveProperty('columns');
  });
});

// ─── EMPTY SCENARIO ───────────────────────────────────────────────────────────

describe('reportService — empty scenario', () => {
  test('vehicle-sales empty: 0 rows', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'empty'
    });
    expect(result.data.rows).toHaveLength(0);
  });

  test('service-transactions empty: 0 rows', () => {
    const result = getReportData('service-transactions', {
      startDate: START, endDate: END, scenario: 'empty'
    });
    expect(result.data.rows).toHaveLength(0);
  });

  test('spare-parts empty: 0 rows', () => {
    const result = getReportData('spare-parts-sales-purchases', {
      startDate: START, endDate: END, scenario: 'empty'
    });
    expect(result.data.rows).toHaveLength(0);
  });

  test('insurance-renewals empty: 0 rows', () => {
    const result = getReportData('insurance-renewals', {
      startDate: START, endDate: END, scenario: 'empty'
    });
    expect(result.data.rows).toHaveLength(0);
  });
});

// ─── MISSING VALUES SCENARIO (CC-48) ─────────────────────────────────────────

describe('reportService — missing scenario (CC-48)', () => {
  test('vehicle-sales missing: returns rows with at least one blank field', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'missing'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
    const hasBlank = result.data.rows.some(row =>
      Object.values(row).some(v => v === '' || v === null || v === undefined)
    );
    expect(hasBlank).toBe(true);
  });

  test('service-transactions missing: has blank fields', () => {
    const result = getReportData('service-transactions', {
      startDate: START, endDate: END, scenario: 'missing'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
  });
});

// ─── DUPLICATES SCENARIO (CC-48) ─────────────────────────────────────────────

describe('reportService — duplicates scenario (CC-48)', () => {
  test('vehicle-sales duplicates: contains duplicate InvoiceNo', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'duplicates'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
    const keys = result.data.rows.map(r => r.InvoiceNo);
    const hasDupe = keys.length !== new Set(keys).size;
    expect(hasDupe).toBe(true);
  });

  test('service-transactions duplicates: contains duplicate JobCardNo', () => {
    const result = getReportData('service-transactions', {
      startDate: START, endDate: END, scenario: 'duplicates'
    });
    const keys = result.data.rows.map(r => r.JobCardNo);
    const hasDupe = keys.length !== new Set(keys).size;
    expect(hasDupe).toBe(true);
  });

  test('insurance-renewals duplicates: contains duplicate PolicyNo', () => {
    const result = getReportData('insurance-renewals', {
      startDate: START, endDate: END, scenario: 'duplicates'
    });
    const keys = result.data.rows.map(r => r.PolicyNo);
    const hasDupe = keys.length !== new Set(keys).size;
    expect(hasDupe).toBe(true);
  });
});

// ─── BAD COLUMNS SCENARIO (CC-48) ────────────────────────────────────────────

describe('reportService — bad-columns scenario (CC-48)', () => {
  test('vehicle-sales bad-columns: rows lack expected columns', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'bad-columns'
    });
    expect(result.data.rows.length).toBeGreaterThan(0);
    // Should NOT have InvoiceNo column
    expect(result.data.rows[0]).not.toHaveProperty('InvoiceNo');
  });

  test('bad-columns rows have unexpected_id column', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'bad-columns'
    });
    expect(result.data.rows[0]).toHaveProperty('unexpected_id');
  });
});


// ─── DATABASE-DRIVEN REPORT CONFIGURATION (NFR-07 / US-10) ───────────────────

describe('reportService — configuration-driven report row generation', () => {
  test('creates synthetic rows for a report schema not hard-coded in the report list', () => {
    const config = {
      report_name: 'warranty_claims',
      unique_key: ['ClaimNo'],
    };
    const columns = ['ClaimNo', 'ClaimDate', 'ClaimAmount', 'ClaimStatus', 'BranchName'];
    const first = createConfiguredRow(config, columns, 0, '2026-11-01', '2026-11-07');
    const second = createConfiguredRow(config, columns, 1, '2026-11-01', '2026-11-07');
    expect(Object.keys(first)).toEqual(columns);
    expect(first.ClaimNo).not.toBe(second.ClaimNo);
    expect(first.ClaimDate).toMatch(/^2026-11-0[1-7]$/);
    expect(typeof first.ClaimAmount).toBe('number');
    expect(['PENDING', 'COMPLETED']).toContain(first.ClaimStatus);
    expect(first.BranchName).toMatch(/^Synthetic/);
  });
});

// ─── INVALID INPUTS — CC-47 ───────────────────────────────────────────────────

describe('reportService — invalid inputs (CC-47)', () => {
  test('invalid reportId returns status 404', () => {
    const result = getReportData('invalid-report-xyz', {
      startDate: START, endDate: END, scenario: 'normal'
    });
    expect(result.status).toBe(404);
    expect(result.error).toMatch(/not found/i);
  });


  test('timeout scenario returns a simulated download timeout', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'timeout'
    });
    expect(result.status).toBe(504);
    expect(result.error).toMatch(/timeout/i);
  });

  test('invalid scenario returns status 400', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, endDate: END, scenario: 'invalid_scenario'
    });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/Invalid test scenario/i);
  });

  test('start date after end date returns status 400', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: '2024-01-10', endDate: '2024-01-01', scenario: 'normal'
    });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/on or before/i);
  });

  test('missing startDate returns status 400', () => {
    const result = getReportData('vehicle-sales-purchases', {
      endDate: END, scenario: 'normal'
    });
    expect(result.status).toBe(400);
  });

  test('missing endDate returns status 400', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: START, scenario: 'normal'
    });
    expect(result.status).toBe(400);
  });

  test('malformed date string returns status 400', () => {
    const result = getReportData('vehicle-sales-purchases', {
      startDate: 'not-a-date', endDate: END, scenario: 'normal'
    });
    expect(result.status).toBe(400);
  });
});
