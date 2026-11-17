import { query } from '../config/db.js';
import cron from 'node-cron';
import { initializeScheduler } from '../services/schedulerService.js';

async function listReports(req, res, next) {
  try {
    const result = await query('SELECT * FROM report_configs ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getReportData(req, res, next) {
  try {
    const { reportName } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const config = await query(
      'SELECT * FROM report_configs WHERE report_name = $1',
      [reportName]
    );

    if (config.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const data = await query(
      `SELECT * FROM ${config.rows[0].report_name} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ report: config.rows[0], data: data.rows });
  } catch (err) {
    next(err);
  }
}

async function updateReport(req, res, next) {
  try {
    const { id } = req.params;

    const {
      download_folder,
      date_strategy,
      schedule_cron,
      required_columns,
      unique_key,
      column_mapping,
      is_enabled
    } = req.body;

    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const allowedDateStrategies = [
      'yesterday',
      'last_7_days',
      'last_30_days',
      'fixed'
      ];

      if (
        typeof download_folder !== 'string' ||
        !download_folder.trim() ||
        !allowedDateStrategies.includes(date_strategy)
      ) {
      return res.status(400).json({
        error: 'Download folder and date strategy are required'
      });
    }

    if (
      schedule_cron !== null &&
      (typeof schedule_cron !== 'string' || !cron.validate(schedule_cron))
    ) {
      return res.status(400).json({ error: 'Invalid cron schedule' });
    }

    if (
      !Array.isArray(required_columns) ||
      !Array.isArray(unique_key) ||
      !column_mapping ||
      typeof column_mapping !== 'object' ||
      Array.isArray(column_mapping) ||
      typeof is_enabled !== 'boolean'
    ) {
      return res.status(400).json({
        error: 'Invalid report configuration data'
      });
    }

    const result = await query(
      `UPDATE report_configs
       SET
         download_folder = $1,
         date_strategy = $2,
         schedule = $3,
         required_columns = $4::jsonb,
         unique_key = $5::jsonb,
         column_mapping = $6::jsonb,
         is_active = $7
       WHERE id = $8
       RETURNING *`,
      [
        download_folder.trim(),
        date_strategy.trim(),
        schedule_cron,
        JSON.stringify(required_columns),
        JSON.stringify(unique_key),
        JSON.stringify(column_mapping),
        is_enabled,
        Number(id)
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    // Reload scheduled jobs using the updated database settings
    await initializeScheduler();

    res.json({
      message: 'Report settings updated successfully',
      report: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

export { listReports, getReportData, updateReport };
