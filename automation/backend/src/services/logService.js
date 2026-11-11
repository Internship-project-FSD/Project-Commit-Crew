import { query } from '../config/db.js';

// saves a log message to both console and database
async function log(runId, level, message, details = null) {
  console.log(`[${level.toUpperCase()}] ${message}`);

  try {
    await query(
      'INSERT INTO run_logs (run_id, level, message, details) VALUES ($1, $2, $3, $4)',
      [runId, level, message, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Failed to write log to DB:', err.message);
  }
}

async function info(runId, message, details) {
  return log(runId, 'info', message, details);
}

async function warn(runId, message, details) {
  return log(runId, 'warn', message, details);
}

async function error(runId, message, details) {
  return log(runId, 'error', message, details);
}

export { info, warn, error };
