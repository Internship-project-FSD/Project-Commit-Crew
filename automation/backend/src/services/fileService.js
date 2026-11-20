import { query } from '../config/db.js';

async function createFileRecord(runId, reportConfigId, fileName, fileHash, metadata = {}, queryFn = query) {
  const result = await queryFn(
    `INSERT INTO files
       (run_id, report_config_id, file_name, file_hash, file_path, file_size, downloaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()))
     RETURNING *`,
    [runId, reportConfigId, fileName, fileHash, metadata.filePath || null, metadata.fileSize ?? null, metadata.downloadedAt || null]
  );
  return result.rows[0];
}

async function updateFileStatus(fileId, status, stats = {}, errorMessage = null, queryFn = query) {
  const result = await queryFn(
    `UPDATE files SET status = $1, total_rows = $2, imported_rows = $3,
     skipped_rows = $4, rejected_rows = $5, error_message = $6,
     processed_at = CASE WHEN $8 THEN NOW() ELSE processed_at END
     WHERE id = $7 RETURNING *`,
    [
      status,
      stats.totalRows ?? 0,
      stats.importedRows ?? 0,
      stats.skippedRows ?? 0,
      stats.rejectedRows ?? 0,
      errorMessage,
      fileId,
      ['success', 'failed', 'duplicate'].includes(status),
    ]
  );
  return result.rows[0];
}
async function isFileAlreadyProcessed(fileHash, queryFn = query) {
  const result = await queryFn(
    "SELECT id FROM files WHERE file_hash = $1 AND status = 'success' LIMIT 1",
    [fileHash]
  );
  return result.rows.length > 0;
}

export { createFileRecord, updateFileStatus, isFileAlreadyProcessed };
