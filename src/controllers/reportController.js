import { query } from '../config/db.js';

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

    const config = await query('SELECT * FROM report_configs WHERE report_name = $1', [reportName]);
    if (config.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    const data = await query(
      `SELECT * FROM ${reportName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ report: config.rows[0], data: data.rows });
  } catch (err) {
    next(err);
  }
}

export { listReports, getReportData };
