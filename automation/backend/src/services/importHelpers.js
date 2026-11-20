const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/i;

function assertSafeIdentifier(identifier, label = 'SQL identifier') {
  if (typeof identifier !== 'string' || !IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid ${label}: ${identifier}`);
  }
  return identifier;
}

function mapCsvRows(rows, columnMapping, fileId, runId) {
  return rows.map((row) => {
    const mapped = { file_id: fileId, run_id: runId };
    for (const [csvColumn, databaseColumn] of Object.entries(columnMapping)) {
      mapped[assertSafeIdentifier(databaseColumn, 'database column')] =
        row[csvColumn] === '' || row[csvColumn] === undefined ? null : row[csvColumn];
    }
    return mapped;
  });
}

function buildBulkInsert(table, rows, maxRowsPerStatement = 250) {
  assertSafeIdentifier(table, 'table name');
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!Number.isInteger(maxRowsPerStatement) || maxRowsPerStatement < 1) {
    throw new Error('maxRowsPerStatement must be a positive integer');
  }
  const columns = Object.keys(rows[0]);
  columns.forEach((column) => assertSafeIdentifier(column, 'database column'));
  const statements = [];

  for (let offset = 0; offset < rows.length; offset += maxRowsPerStatement) {
    const chunk = rows.slice(offset, offset + maxRowsPerStatement);
    const values = [];
    const tuples = chunk.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(row[column] ?? null);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    statements.push({
      text: `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      values,
      rowCount: chunk.length,
    });
  }
  return statements;
}

function selectReportConfigs(configs, reportId = 'all') {
  if (reportId === 'all' || reportId == null || reportId === '') return configs;
  const selected = configs.filter((config) =>
    String(config.id) === String(reportId) ||
    config.portal_path === reportId ||
    config.report_name === reportId
  );
  if (!selected.length) throw new Error(`No active report configuration found for: ${reportId}`);
  return selected;
}

function calculateRunStatus(stats) {
  if (stats.failedFiles > 0 && (stats.successFiles > 0 || stats.duplicateFiles > 0)) return 'partial';
  if (stats.failedFiles > 0) return 'failed';
  return 'success';
}

function stableUniqueKeyHash(row, uniqueKeys, createHash) {
  if (!Array.isArray(uniqueKeys) || uniqueKeys.length === 0) {
    throw new Error('A report must define at least one unique key');
  }
  const values = uniqueKeys.map((key) => {
    if (row[key] === undefined || row[key] === null || String(row[key]).trim() === '') {
      throw new Error(`Unique key ${key} is missing from a row`);
    }
    return String(row[key]).trim();
  });
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

export {
  assertSafeIdentifier,
  mapCsvRows,
  buildBulkInsert,
  selectReportConfigs,
  calculateRunStatus,
  stableUniqueKeyHash,
};
