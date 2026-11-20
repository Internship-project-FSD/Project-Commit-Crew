import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as db from '../config/db.js';
import { computeFileHash } from './hashService.js';
import { validateCsvFile } from './csvValidator.js';
import { createFileRecord, updateFileStatus, isFileAlreadyProcessed } from './fileService.js';
import { startRun, endRun } from './runService.js';
import * as logger from './logService.js';
import {
  assertSafeIdentifier, mapCsvRows, buildBulkInsert, selectReportConfigs,
  calculateRunStatus, stableUniqueKeyHash,
} from './importHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOADS_ROOT = path.resolve(__dirname, '../../../../downloads');
const PROCESSED_DIR = path.join(DOWNLOADS_ROOT, 'processed');
const FAILED_DIR = path.join(DOWNLOADS_ROOT, 'failed');
const TYPED_REPORTS = new Set(['vehicle_sales', 'service_transactions', 'spare_parts', 'insurance_renewals']);
const DEFAULT_SERVICES = { db, computeFileHash, validateCsvFile, createFileRecord, updateFileStatus, isFileAlreadyProcessed, logger };

function getIncomingDir(downloadFolder = 'downloads/incoming') {
  if (typeof downloadFolder !== 'string' || !downloadFolder.trim()) throw new Error('Invalid download folder path');
  const relativeFolder = downloadFolder.replace(/^downloads[\\/]/i, '');
  const incomingDir = path.resolve(DOWNLOADS_ROOT, relativeFolder);
  if (incomingDir === DOWNLOADS_ROOT || !incomingDir.startsWith(DOWNLOADS_ROOT + path.sep)) {
    throw new Error('Invalid download folder path');
  }
  return incomingDir;
}

function moveFile(from, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  const destination = path.join(toDir, path.basename(from));
  try {
    fs.renameSync(from, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.copyFileSync(from, destination);
    fs.unlinkSync(from);
  }
  return destination;
}

function assertReportConfig(reportConfig) {
  if (!reportConfig || !Number.isInteger(Number(reportConfig.id))) throw new Error('Invalid report configuration');
  const reportName = assertSafeIdentifier(reportConfig.report_name, 'report name');
  const columnMapping = reportConfig.column_mapping;
  if (!columnMapping || typeof columnMapping !== 'object' || Array.isArray(columnMapping) || !Object.keys(columnMapping).length) {
    throw new Error('Report column mapping is required');
  }
  Object.values(columnMapping).forEach((column) => assertSafeIdentifier(column, 'database column'));
  if (!Array.isArray(reportConfig.unique_key) || reportConfig.unique_key.length === 0) {
    throw new Error('Report unique key must contain at least one column');
  }
  reportConfig.unique_key.forEach((key) => {
    if (!Object.hasOwn(columnMapping, key)) throw new Error(`Unique key ${key} is not present in column mapping`);
  });
  return { reportName, columnMapping };
}

function getGenericRows(validation, reportConfig, fileId, runId) {
  return validation.validRows.map((row) => ({
    file_id: fileId,
    run_id: runId,
    report_config_id: Number(reportConfig.id),
    row_data: JSON.stringify(row),
  }));
}

async function persistRows(client, validation, reportConfig, fileRecord, runId, reportName, columnMapping) {
  let importedRows = 0;
  let skippedRows = 0;
  const uniqueColumns = reportConfig.unique_key.map((key) => columnMapping[key]);

  if (TYPED_REPORTS.has(reportName)) {
    const stagingTable = assertSafeIdentifier(`stg_${reportName}`, 'staging table');
    const finalTable = assertSafeIdentifier(reportName, 'final table');
    const mappedRows = mapCsvRows(validation.validRows, columnMapping, fileRecord.id, runId);
    for (const statement of buildBulkInsert(stagingTable, mappedRows, 200)) {
      await client.query(statement.text, statement.values);
    }

    if (mappedRows.length) {
      const finalColumns = ['file_id', 'run_id', ...Object.values(columnMapping)];
      const insertResult = await client.query(
        `INSERT INTO ${finalTable} (${finalColumns.join(', ')})
         SELECT ${finalColumns.join(', ')} FROM ${stagingTable} WHERE file_id = $1
         ON CONFLICT (${uniqueColumns.join(', ')}) DO NOTHING RETURNING id`,
        [fileRecord.id]
      );
      importedRows = Number(insertResult.rowCount || insertResult.rows?.length || 0);
    }
    skippedRows = Math.max(0, mappedRows.length - importedRows);
  } else {
    // New report types use a generic JSONB staging/final table. This lets an Admin
    // add a report_config row without creating new PostgreSQL tables or code paths.
    const reportNameSafe = assertSafeIdentifier(reportName, 'report name');
    const genericRows = getGenericRows(validation, reportConfig, fileRecord.id, runId);
    for (const statement of buildBulkInsert('stg_report_records', genericRows, 200)) {
      await client.query(statement.text, statement.values);
    }
    const finalRows = validation.validRows.map((row) => ({
      file_id: fileRecord.id,
      run_id: runId,
      report_config_id: Number(reportConfig.id),
      unique_key_hash: stableUniqueKeyHash(row, reportConfig.unique_key, createHash),
      record_data: JSON.stringify(row),
    }));
    for (const statement of buildBulkInsert('report_records', finalRows, 200)) {
      const insertResult = await client.query(
        `${statement.text.replace(/^INSERT INTO report_records/, 'INSERT INTO report_records')}
         ON CONFLICT (report_config_id, unique_key_hash) DO NOTHING RETURNING id`,
        statement.values
      );
      importedRows += Number(insertResult.rowCount || insertResult.rows?.length || 0);
    }
    skippedRows = Math.max(0, validation.validRows.length - importedRows);
    await logger.info(runId, `Imported configuration-driven report ${reportNameSafe} through generic records table`);
  }

  for (const rejected of validation.rejectedRows) {
    await client.query(
      `INSERT INTO rejected_rows (file_id, row_number, row_data, rejection_reason)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [fileRecord.id, rejected.rowNumber, JSON.stringify(rejected.data), rejected.reason]
    );
  }

  return { importedRows, skippedRows };
}

/** Process one CSV file. The optional services seam allows deterministic tests of this production path. */
async function processFile(runId, filePath, reportConfig, options = {}) {
  const services = { ...DEFAULT_SERVICES, ...(options.services || {}) };
  const fileName = path.basename(filePath);
  let fileRecord;
  let client;

  try {
    if (!fs.existsSync(filePath)) throw new Error(`File does not exist: ${fileName}`);
    await services.logger.info(runId, `Processing file: ${fileName}`);
    const { reportName, columnMapping } = assertReportConfig(reportConfig);
    const fileHash = await services.computeFileHash(filePath);
    const alreadyProcessed = await services.isFileAlreadyProcessed(fileHash);
    const stat = fs.statSync(filePath);
    const metadata = { filePath: path.resolve(filePath), fileSize: stat.size, downloadedAt: stat.mtime };

    if (alreadyProcessed && !options.forceReprocess) {
      fileRecord = await services.createFileRecord(runId, reportConfig.id, fileName, fileHash, metadata);
      await services.updateFileStatus(fileRecord.id, 'duplicate', { skippedRows: 0 });
      await services.logger.warn(runId, `Duplicate file skipped: ${fileName}`, { fileHash, fileId: fileRecord.id });
      moveFile(filePath, PROCESSED_DIR);
      return { status: 'duplicate', totalRows: 0, importedRows: 0, skippedRows: 0, rejectedRows: 0 };
    }

    fileRecord = await services.createFileRecord(runId, reportConfig.id, fileName, fileHash, metadata);
    await services.updateFileStatus(fileRecord.id, 'processing');
    const validation = services.validateCsvFile(filePath, reportConfig);

    if (!validation.isValid) {
      await services.updateFileStatus(fileRecord.id, 'failed', {}, validation.fileError);
      await services.logger.error(runId, `Validation failed: ${validation.fileError}`, { fileId: fileRecord.id, fileName });
      moveFile(filePath, FAILED_DIR);
      return { status: 'failed', totalRows: validation.totalRows || 0, importedRows: 0, skippedRows: 0, rejectedRows: 0, error: validation.fileError };
    }

    client = await services.db.getClient();
    let importedRows = 0;
    let skippedRows = 0;
    await client.query('BEGIN');
    try {
      ({ importedRows, skippedRows } = await persistRows(client, validation, reportConfig, fileRecord, runId, reportName, columnMapping));
      await client.query(
        `UPDATE files SET status = 'success', total_rows = $1, imported_rows = $2,
         skipped_rows = $3, rejected_rows = $4, error_message = NULL, processed_at = NOW()
         WHERE id = $5`,
        [validation.totalRows, importedRows, skippedRows, validation.rejectedRows.length, fileRecord.id]
      );
      await client.query('COMMIT');
    } catch (error) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) { await services.logger.error(runId, `Rollback failed: ${rollbackError.message}`); }
      throw error;
    } finally {
      client.release();
      client = null;
    }

    for (const rejected of validation.rejectedRows) {
      await services.logger.warn(runId, `Row ${rejected.rowNumber} rejected: ${rejected.reason}`, {
        fileId: fileRecord.id, fileName, rowNumber: rejected.rowNumber, reason: rejected.reason,
      });
    }
    const stats = { totalRows: validation.totalRows, importedRows, skippedRows, rejectedRows: validation.rejectedRows.length };
    await services.logger.info(runId, `Done: ${importedRows} imported, ${skippedRows} skipped, ${stats.rejectedRows} rejected`);
    moveFile(filePath, PROCESSED_DIR);
    return { status: 'success', ...stats };
  } catch (error) {
    if (client) client.release();
    if (fileRecord?.id) {
      try { await services.updateFileStatus(fileRecord.id, 'failed', {}, error.message); } catch {}
    }
    await services.logger.error(runId, `File processing failed: ${error.message}`, { fileId: fileRecord?.id || null, fileName });
    if (fs.existsSync(filePath)) {
      try { moveFile(filePath, FAILED_DIR); } catch (moveError) {
        await services.logger.error(runId, `Could not move failed file ${fileName}: ${moveError.message}`);
      }
    }
    return { status: 'failed', totalRows: 0, importedRows: 0, skippedRows: 0, rejectedRows: 0, error: error.message };
  }
}

async function runFullImport(triggerType, reportId = 'all', existingRunId = null, options = {}) {
  const injected = options.services || {};
  const runLogger = injected.logger || logger;
  const queryDb = injected.db || db;
  const beginRun = injected.startRun || startRun;
  const finishRun = injected.endRun || endRun;
  const processOneFile = injected.processFile || processFile;
  const knownDownloadFailures = new Set((options.downloadFailedReports || []).map(String));
  const run = existingRunId ? { id: existingRunId } : await beginRun(triggerType);
  await runLogger.info(run.id, 'Import run started');
  const configsResult = await queryDb.query('SELECT * FROM report_configs WHERE is_active = true ORDER BY id');
  const selectedConfigs = selectReportConfigs(configsResult.rows, reportId);
  if (!selectedConfigs.length) throw new Error('No active report configurations are available.');

  const stats = {
    totalFiles: Number(options.downloadFailures || 0),
    successFiles: 0,
    failedFiles: Number(options.downloadFailures || 0),
    duplicateFiles: 0,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    rejectedRows: 0,
  };

  for (const config of selectedConfigs) {
    try {
      const incomingDir = getIncomingDir(config.download_folder || 'downloads/incoming');
      fs.mkdirSync(incomingDir, { recursive: true });
      const csvFiles = fs.readdirSync(incomingDir)
        .filter((name) => name.startsWith(`${config.report_name}_`) && name.toLowerCase().endsWith('.csv'))
        .sort();
      if (csvFiles.length === 0) {
        const isKnownFailure = knownDownloadFailures.has(String(config.portal_path || '')) ||
          knownDownloadFailures.has(String(config.report_name || ''));
        if (!isKnownFailure) {
          stats.totalFiles += 1;
          stats.failedFiles += 1;
          await runLogger.error(run.id, `No downloaded CSV file found for report: ${config.report_name}`);
        }
      }
      for (const file of csvFiles) {
        stats.totalFiles += 1;
        let result;
        try {
          result = await processOneFile(run.id, path.join(incomingDir, file), config, options);
        } catch (error) {
          result = { status: 'failed', totalRows: 0, importedRows: 0, skippedRows: 0, rejectedRows: 0, error: error.message };
          await runLogger.error(run.id, `Report file ${file} failed: ${error.message}`);
        }
        if (result.status === 'success') stats.successFiles += 1;
        else if (result.status === 'duplicate') { stats.duplicateFiles += 1; stats.successFiles += 1; }
        else stats.failedFiles += 1;
        stats.totalRows += result.totalRows || 0;
        stats.importedRows += result.importedRows || 0;
        stats.skippedRows += result.skippedRows || 0;
        stats.rejectedRows += result.rejectedRows || 0;
      }
    } catch (error) {
      stats.failedFiles += 1;
      stats.totalFiles += 1;
      await runLogger.error(run.id, `Report ${config.report_name} could not be processed: ${error.message}`);
    }
  }

  const status = calculateRunStatus(stats);
  await finishRun(run.id, status, stats);
  await runLogger.info(run.id, `Run finished: ${status}`);
  return { runId: run.id, status, ...stats };
}

export { processFile, runFullImport, getIncomingDir, moveFile, assertReportConfig, persistRows };
