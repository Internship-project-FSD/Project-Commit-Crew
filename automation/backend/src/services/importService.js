import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as db from '../config/db.js';
import { computeFileHash } from './hashService.js';
import { validateCsvFile } from './csvValidator.js';
import { createFileRecord, updateFileStatus, isFileAlreadyProcessed } from './fileService.js';
import { startRun, endRun } from './runService.js';
import * as logger from './logService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INCOMING_DIR = path.join(__dirname, '../../../../downloads/incoming');
const PROCESSED_DIR = path.join(__dirname, '../../../../downloads/processed');
const FAILED_DIR = path.join(__dirname, '../../../../downloads/failed');


// move a file from one folder to another
function moveFile(from, toDir) {
  try {
    const name = path.basename(from);
    fs.renameSync(from, path.join(toDir, name));
  } catch (err) {
    console.error('Failed to move file:', err.message);
  }
}


// process one csv file: validate it, insert into staging, then final table
async function processFile(runId, filePath, reportConfig) {
  const fileName = path.basename(filePath);
  await logger.info(runId, 'Processing file: ' + fileName);

  // step 1: compute hash and check for duplicate
  const fileHash = await computeFileHash(filePath);

 const alreadyDone = await isFileAlreadyProcessed(fileHash);

if (alreadyDone) {
  await logger.warn(runId, 'Duplicate file skipped: ' + fileName);

  moveFile(filePath, PROCESSED_DIR);

  return {
    status: 'duplicate',
    totalRows: 0,
    importedRows: 0,
    rejectedRows: 0
  };
}

  // step 2: create a record in the files table
  const fileRecord = await createFileRecord(runId, reportConfig.id, fileName, fileHash);
  await updateFileStatus(fileRecord.id, 'processing');

  // step 3: validate the csv
  const validation = validateCsvFile(filePath, reportConfig);

  if (!validation.isValid) {
    await updateFileStatus(fileRecord.id, 'failed', {}, validation.fileError);
    await logger.error(runId, 'Validation failed: ' + validation.fileError);
    moveFile(filePath, FAILED_DIR);
    return { status: 'failed', totalRows: 0, importedRows: 0, rejectedRows: 0 };
  }

  // step 4: insert valid rows into staging table, then copy to final table
  const columnMapping = reportConfig.column_mapping;
  const stagingTable = 'stg_' + reportConfig.report_name;
  const finalTable = reportConfig.report_name;
  const uniqueKey = reportConfig.unique_key;

  const client = await db.getClient();
  let importedRows = 0;

  try {
    await client.query('BEGIN');

    // insert each valid row into the staging table
    for (const row of validation.validRows) {
      // convert csv column names to database column names
      const dbRow = {};
      for (const [csvCol, dbCol] of Object.entries(columnMapping)) {
        dbRow[dbCol] = row[csvCol] || null;
      }
      dbRow.file_id = fileRecord.id;

      // build the INSERT query
      const columns = Object.keys(dbRow);
      const values = Object.values(dbRow);
      const placeholders = values.map((_, i) => '$' + (i + 1));

      await client.query(
        'INSERT INTO ' + stagingTable + ' (' + columns.join(',') + ') VALUES (' + placeholders.join(',') + ')',
        values
      );
    }

    // copy from staging to final table (skip duplicates)
    const uniqueCols = uniqueKey.map(k => columnMapping[k]);
    const allCols = Object.values(columnMapping);
    const colList = ['file_id', ...allCols].join(',');

    await client.query(
      'INSERT INTO ' + finalTable + ' (' + colList + ') ' +
      'SELECT ' + colList + ' FROM ' + stagingTable + ' WHERE file_id = $1 ' +
      'ON CONFLICT (' + uniqueCols.join(',') + ') DO NOTHING',
      [fileRecord.id]
    );

    // count how many rows actually made it to the final table
    const countResult = await client.query(
      'SELECT COUNT(*) as cnt FROM ' + finalTable + ' WHERE file_id = $1',
      [fileRecord.id]
    );
    importedRows = parseInt(countResult.rows[0].cnt);

    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    await updateFileStatus(fileRecord.id, 'failed', {}, err.message);
    await logger.error(runId, 'Import failed: ' + err.message);
    moveFile(filePath, FAILED_DIR);
    return { status: 'failed', totalRows: validation.totalRows, importedRows: 0, rejectedRows: 0 };

  } finally {
    client.release();
  }

  // step 5: save rejected rows to the database
  for (const rejected of validation.rejectedRows) {
    await db.query(
      'INSERT INTO rejected_rows (file_id, row_number, row_data, rejection_reason) VALUES ($1, $2, $3, $4)',
      [fileRecord.id, rejected.rowNumber, JSON.stringify(rejected.data), rejected.reason]
    );
  }

  // step 6: update file status and move to processed folder
  const stats = {
    totalRows: validation.totalRows,
    importedRows: importedRows,
    rejectedRows: validation.rejectedRows.length
  };

  await updateFileStatus(fileRecord.id, 'success', stats);
  await logger.info(runId, 'Done: ' + importedRows + ' imported, ' + stats.rejectedRows + ' rejected');
  moveFile(filePath, PROCESSED_DIR);

  return { status: 'success', ...stats };
}


// run the full import for all report types
async function runFullImport(triggerType, reportId = 'all', existingRunId = null) {
  const run = existingRunId
    ? { id: existingRunId }
    : await startRun(triggerType);
  await logger.info(run.id, 'Import run started');

  // get active report configs from the database
const configsResult = await db.query(
  'SELECT * FROM report_configs WHERE is_active = true'
);

// map dashboard report IDs to database report names
const reportNameMap = {
  'vehicle-sales-purchases': 'vehicle_sales',
  'service-transactions': 'service_transactions',
  'spare-parts-sales-purchases': 'spare_parts',
  'insurance-renewals': 'insurance_renewals'
};

// select only the requested report, or all reports
const selectedReportName = reportId === 'all'
  ? null
  : reportNameMap[reportId];

if (reportId !== 'all' && !selectedReportName) {
  throw new Error('Invalid report ID: ' + reportId);
}

const selectedConfigs = reportId === 'all'
  ? configsResult.rows
  : configsResult.rows.filter(
      config => config.report_name === selectedReportName
    );

if (selectedConfigs.length === 0) {
  throw new Error('No active report configuration found for: ' + reportId);
}
  const stats = {
    totalFiles: 0,
    successFiles: 0,
    failedFiles: 0,
    duplicateFiles: 0,
    totalRows: 0,
    importedRows: 0,
    rejectedRows: 0
  };

  // go through each report type
  for (const config of selectedConfigs) {

    // find csv files in incoming folder that match this report type
    const csvFiles = fs.readdirSync(INCOMING_DIR).filter(f =>
      f.startsWith(config.report_name) && f.endsWith('.csv')
    );

    // process each file
    for (const file of csvFiles) {
      stats.totalFiles++;
      const filePath = path.join(INCOMING_DIR, file);
      const result = await processFile(run.id, filePath, config);

        if (result.status === 'success') {
        stats.successFiles++;
      } else if (result.status === 'duplicate') {
        stats.duplicateFiles++;
      } else {
        stats.failedFiles++;
      }
      stats.totalRows += result.totalRows;
      stats.importedRows += result.importedRows;
      stats.rejectedRows += result.rejectedRows;
    }
  }

  // decide the final run status
  let runStatus = 'success';
  if (stats.failedFiles > 0 && stats.successFiles > 0) runStatus = 'partial';
  else if (stats.failedFiles > 0 && stats.successFiles === 0) runStatus = 'failed';

  await endRun(run.id, runStatus, stats);
  await logger.info(run.id, 'Run finished: ' + runStatus);

  return { runId: run.id, status: runStatus, ...stats };
}

export { processFile, runFullImport };
