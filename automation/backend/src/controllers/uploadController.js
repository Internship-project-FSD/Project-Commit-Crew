import path from 'node:path';
import { query } from '../config/db.js';
import { processFile } from '../services/importService.js';
import { startRun, endRun } from '../services/runService.js';
import * as logger from '../services/logService.js';

async function uploadFile(req, res, next) {
  let run;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const reportName = String(req.body.report_name || '').trim();
    if (!reportName) return res.status(400).json({ error: 'report_name is required' });

    const config = await query('SELECT * FROM report_configs WHERE report_name = $1 AND is_active = true', [reportName]);
    if (!config.rows.length) return res.status(404).json({ error: 'Active report type not found' });

    run = await startRun('upload');
    await logger.info(run.id, `Manual file upload received: ${path.basename(req.file.originalname)}`, { reportName });
    const result = await processFile(run.id, req.file.path, config.rows[0], {
      forceReprocess: req.body.forceReprocess === 'true',
    });

    const succeeded = result.status === 'success' || result.status === 'duplicate';
    await endRun(run.id, succeeded ? 'success' : 'failed', {
      totalFiles: 1,
      successFiles: succeeded ? 1 : 0,
      failedFiles: succeeded ? 0 : 1,
      totalRows: result.totalRows || 0,
      importedRows: result.importedRows || 0,
      skippedRows: result.skippedRows || 0,
      rejectedRows: result.rejectedRows || 0,
    });
    return res.json({ runId: run.id, ...result });
  } catch (error) {
    if (run?.id) {
      await logger.error(run.id, `Manual upload failed: ${error.message}`);
      try {
        await endRun(run.id, 'failed', {
          totalFiles: 1, successFiles: 0, failedFiles: 1,
          totalRows: 0, importedRows: 0, skippedRows: 0, rejectedRows: 0,
        });
      } catch (updateError) {
        console.error('Could not mark upload run failed:', updateError.message);
      }
    }
    return next(error);
  }
}

export { uploadFile };
