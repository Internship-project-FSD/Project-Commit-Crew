import { query } from '../config/db.js';

async function startRun(triggerType) {
  const result = await query('INSERT INTO runs (trigger_type) VALUES ($1) RETURNING *', [triggerType]);
  return result.rows[0];
}

async function endRun(runId, status, stats = {}) {
  const result = await query(
    `UPDATE runs SET status = $1, ended_at = NOW(), total_files = $3,
      success_files = $4, failed_files = $5, total_rows = $6,
      imported_rows = $7, skipped_rows = $8, rejected_rows = $9
     WHERE id = $2 RETURNING *`,
    [status, runId, stats.totalFiles ?? 0, stats.successFiles ?? 0, stats.failedFiles ?? 0,
      stats.totalRows ?? 0, stats.importedRows ?? 0, stats.skippedRows ?? 0, stats.rejectedRows ?? 0]
  );
  return result.rows[0];
}

async function getRuns(limit = 20, offset = 0) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const result = await query(
    `SELECT r.*, COALESCE((SELECT json_agg(f ORDER BY f.id) FROM files f WHERE f.run_id = r.id), '[]'::json) AS files
     FROM runs r ORDER BY r.started_at DESC LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );
  return result.rows;
}

async function getRunById(runId) {
  const run = await query('SELECT * FROM runs WHERE id = $1', [runId]);
  if (run.rows.length === 0) return null;
  const [files, logs, rejectedRows] = await Promise.all([
    query(`SELECT f.*, rc.report_name FROM files f JOIN report_configs rc ON rc.id = f.report_config_id WHERE f.run_id = $1 ORDER BY f.id`, [runId]),
    query('SELECT * FROM run_logs WHERE run_id = $1 ORDER BY created_at', [runId]),
    query(`SELECT rr.*, rc.report_name FROM rejected_rows rr JOIN files f ON f.id = rr.file_id
           JOIN report_configs rc ON rc.id = f.report_config_id WHERE f.run_id = $1 ORDER BY rr.file_id, rr.row_number`, [runId]),
  ]);
  return { ...run.rows[0], files: files.rows, logs: logs.rows, rejected_rows: rejectedRows.rows };
}

export { startRun, endRun, getRuns, getRunById };
