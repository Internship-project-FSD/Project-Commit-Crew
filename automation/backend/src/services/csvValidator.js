import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

const NUMBER_TYPES = new Set(['number', 'numeric', 'decimal', 'integer']);

function inferColumnType(csvColumn, dbColumn = '') {
  // Inspect each name independently. Appending an undefined mapping to the CSV
  // header used to hide camelCase/PascalCase suffixes such as InvoiceDate.
  const names = [csvColumn, dbColumn]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).toLowerCase());

  const isDateColumn = names.some((name) =>
    /(?:^|[_\s])date(?:$|[_\s])/.test(name) ||
    /date$/.test(name) ||
    /policy(start|end)/.test(name)
  );
  if (isDateColumn) return 'date';

  const joinedName = names.join(' ');
  if (/(odometer|mileage|distance|quantity|qty|count|units)/.test(joinedName)) return 'integer';
  if (/(amount|price|premium|tax|total|rate|cost|labour|parts|balance|discount|value)/.test(joinedName)) return 'number';
  return 'string';
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidNumber(value, type = 'number') {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const normalized = String(value).trim();
  if (!/^-?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/.test(normalized)) return false;
  const numericValue = normalized.replaceAll(',', '');
  const number = Number(numericValue);
  if (!Number.isFinite(number)) return false;
  return type !== 'integer' || Number.isSafeInteger(number);
}

function validateCsvFile(filePath, reportConfig = {}) {
  const requiredColumns = Array.isArray(reportConfig.required_columns) ? reportConfig.required_columns : [];
  const columnMapping = reportConfig.column_mapping || {};
  const configuredTypes = reportConfig.column_types || {};
  const result = { isValid: true, fileError: null, validRows: [], rejectedRows: [], totalRows: 0 };

  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return { ...result, isValid: false, fileError: `Cannot read file: ${error.message}` };
  }
  if (fileContent.replace(/^\uFEFF/, '').trim().length === 0) {
    return { ...result, isValid: false, fileError: 'File is empty' };
  }

  let records;
  try {
    records = parse(fileContent, {
      bom: true,
      columns: (headers) => headers.map((header) => String(header).trim()),
      skip_empty_lines: true,
      trim: true,
      skip_records_with_empty_values: false,
      relax_column_count: false,
    });
  } catch (error) {
    return { ...result, isValid: false, fileError: `CSV parse error: ${error.message}` };
  }

  if (!records.length) return { ...result, isValid: false, fileError: 'No data rows found' };
  const csvColumns = Object.keys(records[0]);
  const missingColumns = requiredColumns.filter((column) => !csvColumns.includes(column));
  if (missingColumns.length) {
    return { ...result, isValid: false, fileError: `Missing columns: ${missingColumns.join(', ')}` };
  }

  result.totalRows = records.length;
  const typeFor = (column) => configuredTypes[column] || inferColumnType(column, columnMapping[column]);

  records.forEach((row, index) => {
    const errors = [];
    for (const column of requiredColumns) {
      if (row[column] === undefined || String(row[column]).trim() === '') errors.push(`${column} is empty`);
    }
    for (const [column, rawValue] of Object.entries(row)) {
      const value = rawValue == null ? '' : String(rawValue).trim();
      if (!value) continue;
      const type = typeFor(column);
      if (type === 'date' && !isValidDate(value)) {
        errors.push(`${column} must be a valid date in YYYY-MM-DD format`);
      } else if (NUMBER_TYPES.has(type) && !isValidNumber(value, type)) {
        errors.push(`${column} must be a valid ${type}`);
      }
    }
    if (errors.length) result.rejectedRows.push({ rowNumber: index + 2, data: row, reason: errors.join('; ') });
    else result.validRows.push(row);
  });
  return result;
}

export { validateCsvFile, inferColumnType, isValidDate, isValidNumber };
