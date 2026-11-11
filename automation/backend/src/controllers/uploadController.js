import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/db.js';
import { processFile } from '../services/importService.js';
import { startRun, endRun } from '../services/runService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function uploadFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const reportName = req.body.report_name;
    if (!reportName) return res.status(400).json({ error: 'report_name is required' });

    const config = await query('SELECT * FROM report_configs WHERE report_name = $1', [reportName]);
    if (config.rows.length === 0) return res.status(404).json({ error: 'Report type not found' });

    const run = await startRun('upload');
    const result = await processFile(run.id, req.file.path, config.rows[0]);

    let status = result.status === 'success' ? 'success' : 'failed';
    await endRun(run.id, status, {
      totalFiles: 1,
      successFiles: result.status === 'success' ? 1 : 0,
      failedFiles: result.status === 'failed' ? 1 : 0,
      totalRows: result.totalRows,
      importedRows: result.importedRows,
      rejectedRows: result.rejectedRows
    });

    res.json({ runId: run.id, ...result });
  } catch (err) {
    next(err);
  }
}

export { uploadFile };
