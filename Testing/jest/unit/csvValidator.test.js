'use strict';

/**
 * Unit Tests: csvValidator.js
 *
 * Tests the actual validateCsvFile function from the automation backend.
 * No mocks — all tests use real file I/O via the actual implementation.
 *
 * SRS Coverage: FR-11 (CSV validation), FR-12 (rejected rows), FR-10 (file reading)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');

// --- Import the actual module under test ---
// The automation backend is ESM ("type":"module"), but babel-jest transpiles it to CJS for Jest.
const { validateCsvFile } = require('../../../automation/backend/src/services/csvValidator.js');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'csvs');

// Report configs matching the actual DB seed data (002_seed.sql)
const VEHICLE_SALES_CONFIG = {
  required_columns: [
    'InvoiceNo', 'InvoiceDate', 'CustomerName', 'VehicleModel',
    'Variant', 'Color', 'ChassisNo', 'EngineNo', 'SaleAmount',
    'TaxAmount', 'TotalAmount', 'PaymentMode', 'Salesperson'
  ]
};

const SERVICE_TX_CONFIG = {
  required_columns: [
    'JobCardNo', 'JobCardDate', 'CustomerName', 'VehicleRegNo',
    'VehicleModel', 'ServiceType', 'LabourAmount', 'PartsAmount',
    'TotalAmount', 'ServiceAdvisor', 'Status'
  ]
};

const SPARE_PARTS_CONFIG = {
  required_columns: [
    'PartNo', 'PartName', 'Category', 'Quantity', 'UnitPrice',
    'TotalPrice', 'InvoiceNo', 'InvoiceDate', 'CustomerName'
  ]
};

const INSURANCE_CONFIG = {
  required_columns: [
    'PolicyNo', 'CustomerName', 'VehicleRegNo', 'VehicleModel',
    'Insurer', 'PremiumAmount', 'PolicyStart', 'PolicyEnd', 'RenewalStatus'
  ]
};

// Helper: write a temporary CSV and return its path
function writeTempCsv(content) {
  const tmpFile = path.join(os.tmpdir(), `dms-test-${process.pid}-${randomUUID()}.csv`);
  fs.writeFileSync(tmpFile, content, 'utf-8');
  return tmpFile;
}

// ─── VEHICLE SALES ───────────────────────────────────────────────────────────

describe('csvValidator — Vehicle Sales', () => {
  test('valid file: isValid=true, 3 rows, 0 rejected', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_valid.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.isValid).toBe(true);
    expect(result.fileError).toBeNull();
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.rejectedRows).toHaveLength(0);
  });

  test('empty file: isValid=false, fileError="File is empty"', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_empty.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.isValid).toBe(false);
    expect(result.fileError).toBe('File is empty');
  });

  test('header-only file: isValid=false, fileError="No data rows found"', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_header_only.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.isValid).toBe(false);
    expect(result.fileError).toBe('No data rows found');
  });

  test('bad columns: isValid=false, fileError contains "Missing columns"', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_bad_columns.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.isValid).toBe(false);
    expect(result.fileError).toMatch(/Missing columns/i);
  });

  test('missing values: row with blanks goes to rejectedRows', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_missing_values.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.isValid).toBe(true);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toHaveLength(2);
    expect(result.rejectedRows).toHaveLength(1);
    // Rejected row must carry rowNumber, reason and data
    const rejected = result.rejectedRows[0];
    expect(rejected).toHaveProperty('rowNumber');
    expect(rejected).toHaveProperty('reason');
    expect(rejected).toHaveProperty('data');
    expect(typeof rejected.reason).toBe('string');
    expect(rejected.reason.length).toBeGreaterThan(0);
  });

  test('rejected row rowNumber is correct (header=row 1, first data=row 2)', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_missing_values.csv'),
      VEHICLE_SALES_CONFIG
    );
    // The blank row is the second data row → rowNumber 3
    expect(result.rejectedRows[0].rowNumber).toBe(3);
  });

  test('non-existent file: isValid=false, fileError contains "Cannot read file"', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'does_not_exist.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.isValid).toBe(false);
    expect(result.fileError).toMatch(/Cannot read file/i);
  });

  test('inline CSV with all required fields: returns validRows', () => {
    const csv = [
      'InvoiceNo,InvoiceDate,CustomerName,VehicleModel,Variant,Color,ChassisNo,EngineNo,SaleAmount,TaxAmount,TotalAmount,PaymentMode,Salesperson',
      'TEST-001,2024-01-01,Test Customer,Test Model,VXI,Blue,CHASSIS001,ENGINE001,100000,18000,118000,Cash,Test Sales'
    ].join('\n');
    const tmpFile = writeTempCsv(csv);
    const result = validateCsvFile(tmpFile, VEHICLE_SALES_CONFIG);
    expect(result.isValid).toBe(true);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].InvoiceNo).toBe('TEST-001');
    fs.unlinkSync(tmpFile);
  });
});

// ─── SERVICE TRANSACTIONS ─────────────────────────────────────────────────────

describe('csvValidator — Service Transactions', () => {
  test('valid file: isValid=true, 3 rows, 0 rejected', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'service_transactions_valid.csv'),
      SERVICE_TX_CONFIG
    );
    expect(result.isValid).toBe(true);
    expect(result.validRows).toHaveLength(3);
    expect(result.rejectedRows).toHaveLength(0);
  });

  test('detects missing JobCardNo as bad column when wrong headers supplied', () => {
    const csv = 'WrongCol,JobCardDate,CustomerName,VehicleRegNo,VehicleModel,ServiceType,LabourAmount,PartsAmount,TotalAmount,ServiceAdvisor,Status\nv1,2024-01-01,C,R,M,S,100,200,300,A,Done';
    const tmpFile = writeTempCsv(csv);
    const result = validateCsvFile(tmpFile, SERVICE_TX_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.fileError).toMatch(/Missing columns/i);
    fs.unlinkSync(tmpFile);
  });
});

// ─── SPARE PARTS ──────────────────────────────────────────────────────────────

describe('csvValidator — Spare Parts', () => {
  test('valid file: isValid=true, all rows accepted', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'spare_parts_valid.csv'),
      SPARE_PARTS_CONFIG
    );
    expect(result.isValid).toBe(true);
    expect(result.validRows.length).toBeGreaterThan(0);
  });
});

// ─── INSURANCE RENEWALS ───────────────────────────────────────────────────────

describe('csvValidator — Insurance Renewals', () => {
  test('valid file: isValid=true, all rows accepted', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'insurance_renewals_valid.csv'),
      INSURANCE_CONFIG
    );
    expect(result.isValid).toBe(true);
    expect(result.validRows.length).toBeGreaterThan(0);
  });

  test('row missing PolicyNo goes to rejectedRows', () => {
    const csv = [
      'PolicyNo,CustomerName,VehicleRegNo,VehicleModel,Insurer,PremiumAmount,PolicyStart,PolicyEnd,RenewalStatus',
      'POL-001,Ravi,KL01,Swift,HDFC,10000,2024-01-01,2025-01-01,Renewed',
      ',Priya,KL02,Alto,LIC,8000,2024-01-01,2025-01-01,Pending'
    ].join('\n');
    const tmpFile = writeTempCsv(csv);
    const result = validateCsvFile(tmpFile, INSURANCE_CONFIG);
    expect(result.isValid).toBe(true);
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0].reason).toMatch(/PolicyNo/);
    fs.unlinkSync(tmpFile);
  });
});


// ─── DATE AND NUMERIC FIELD VALIDATION (FR-14) ────────────────────────────────

describe('csvValidator — date and numeric formats (FR-14)', () => {
  test('rejects an impossible calendar date', () => {
    const csv = [
      'InvoiceNo,InvoiceDate,CustomerName,VehicleModel,Variant,Color,ChassisNo,EngineNo,SaleAmount,TaxAmount,TotalAmount,PaymentMode,Salesperson',
      'INV-BAD-DATE,2024-02-30,Test Customer,Test Model,VXI,Blue,CHASSIS001,ENGINE001,100000,18000,118000,Cash,Test Sales'
    ].join('\n');
    const tmpFile = writeTempCsv(csv);
    try {
      const result = validateCsvFile(tmpFile, VEHICLE_SALES_CONFIG);
      expect(result.rejectedRows).toHaveLength(1);
      expect(result.rejectedRows[0].reason).toMatch(/InvoiceDate.*valid date/i);
    } finally { fs.unlinkSync(tmpFile); }
  });

  test('rejects non-numeric amount fields and accepts correctly formatted numbers', () => {
    const csv = [
      'InvoiceNo,InvoiceDate,CustomerName,VehicleModel,Variant,Color,ChassisNo,EngineNo,SaleAmount,TaxAmount,TotalAmount,PaymentMode,Salesperson',
      'INV-BAD-AMOUNT,2024-02-01,Test Customer,Test Model,VXI,Blue,CHASSIS001,ENGINE001,not-a-number,18000,118000,Cash,Test Sales',
      'INV-GOOD-AMOUNT,2024-02-02,Test Customer,Test Model,VXI,Blue,CHASSIS002,ENGINE002,"100,000.50",18000,118000.50,Cash,Test Sales'
    ].join('\n');
    const tmpFile = writeTempCsv(csv);
    try {
      const result = validateCsvFile(tmpFile, VEHICLE_SALES_CONFIG);
      expect(result.validRows).toHaveLength(1);
      expect(result.rejectedRows).toHaveLength(1);
      expect(result.rejectedRows[0].reason).toMatch(/SaleAmount.*valid number/i);
    } finally { fs.unlinkSync(tmpFile); }
  });
});

// ─── STRUCTURE ASSERTIONS ─────────────────────────────────────────────────────

describe('csvValidator — Result structure', () => {
  test('result always has isValid, fileError, validRows, rejectedRows, totalRows', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_valid.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('fileError');
    expect(result).toHaveProperty('validRows');
    expect(result).toHaveProperty('rejectedRows');
    expect(result).toHaveProperty('totalRows');
    expect(Array.isArray(result.validRows)).toBe(true);
    expect(Array.isArray(result.rejectedRows)).toBe(true);
  });

  test('validRows sum + rejectedRows count equals totalRows', () => {
    const result = validateCsvFile(
      path.join(FIXTURES, 'vehicle_sales_missing_values.csv'),
      VEHICLE_SALES_CONFIG
    );
    expect(result.validRows.length + result.rejectedRows.length).toBe(result.totalRows);
  });
});
