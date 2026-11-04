import { query } from '../config/db.js';

// create a new run (a batch job) and return it
async function startRun(triggerType) {
  const result = await query(
    'INSERT INTO runs (trigger_type) VALUES ($1) RETURNING *',
    [triggerType]
  );
  return result.rows[0];
}

// mark a run as finished and save the final numbers
async function endRun(runId, status, stats) {
  const result = await query(
    `UPDATE runs SET
      status = $1,
      ended_at = NOW(),
      total_files = $3,
      success_files = $4,
      failed_files = $5,
      total_rows = $6,
      imported_rows = $7,
      rejected_rows = $8
     WHERE id = $2 RETURNING *`,
    [
      status, runId,
      stats.totalFiles, stats.successFiles, stats.failedFiles,
      stats.totalRows, stats.importedRows, stats.rejectedRows
    ]
  );
  return result.rows[0];
}

// get list of recent runs
async function getRuns(limit = 20, offset = 0) {
  const result = await query(
    'SELECT * FROM runs ORDER BY started_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

// get one run with its files and logs
async function getRunById(runId) {
  const run = await query('SELECT * FROM runs WHERE id = $1', [runId]);
  if (run.rows.length === 0) return null;

  const files = await query('SELECT * FROM files WHERE run_id = $1', [runId]);
  const logs = await query(
    'SELECT * FROM run_logs WHERE run_id = $1 ORDER BY created_at',
    [runId]
  );

  return {
    ...run.rows[0],
    files: files.rows,
    logs: logs.rows
  };
}

export { startRun, endRun, getRuns, getRunById };
