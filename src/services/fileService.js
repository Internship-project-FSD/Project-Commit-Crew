import { query } from '../config/db.js';

// save a new file record when we start processing a csv
async function createFileRecord(runId, reportConfigId, fileName, fileHash) {
  const result = await query(
    'INSERT INTO files (run_id, report_config_id, file_name, file_hash) VALUES ($1, $2, $3, $4) RETURNING *',
    [runId, reportConfigId, fileName, fileHash]
  );
  return result.rows[0];
}

// update the file status after processing (success, failed, etc)
async function updateFileStatus(fileId, status, stats = {}, errorMessage = null) {
  const result = await query(
    `UPDATE files SET status = $1, total_rows = $2, imported_rows = $3,
     rejected_rows = $4, error_message = $5 WHERE id = $6 RETURNING *`,
    [status, stats.totalRows || 0, stats.importedRows || 0,
     stats.rejectedRows || 0, errorMessage, fileId]
  );
  return result.rows[0];
}

// check if we already processed this exact file before (by its hash)
async function isFileAlreadyProcessed(fileHash) {
  const result = await query(
    "SELECT id FROM files WHERE file_hash = $1 AND status = 'success'",
    [fileHash]
  );
  return result.rows.length > 0;
}

export { createFileRecord, updateFileStatus, isFileAlreadyProcessed };
