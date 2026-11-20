import { query } from '../config/db.js';
import cron from 'node-cron';
import { initializeScheduler } from '../services/schedulerService.js';
import { assertSafeIdentifier } from '../services/importHelpers.js';
import { getIncomingDir } from '../services/importService.js';

const DATE_STRATEGIES = ['yesterday', 'last_7_days', 'last_30_days', 'fixed'];

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateConfigPayload(payload) {
  const {
    report_name: reportName,
    portal_path: portalPath,
    download_folder: downloadFolder,
    date_strategy: dateStrategy,
    schedule_cron: scheduleCron,
    required_columns: requiredColumns,
    unique_key: uniqueKey,
    column_mapping: columnMapping,
    is_enabled: isEnabled,
    fixed_start_date: fixedStartDate = null,
    fixed_end_date: fixedEndDate = null,
  } = payload;

  if (reportName !== undefined && !/^[a-z][a-z0-9_]*$/.test(reportName)) throw new Error('Report name must use lowercase letters, numbers and underscores.');
  if (portalPath !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(portalPath)) throw new Error('Portal path must be a lowercase URL slug.');
  if (typeof downloadFolder !== 'string' || !downloadFolder.trim()) throw new Error('Download folder is required.');
  getIncomingDir(downloadFolder.trim());
  if (!DATE_STRATEGIES.includes(dateStrategy)) throw new Error('Invalid date strategy.');
  if (scheduleCron != null && (typeof scheduleCron !== 'string' || !cron.validate(scheduleCron))) throw new Error('Invalid cron schedule.');
  if (!Array.isArray(requiredColumns) || !requiredColumns.length) throw new Error('Required columns must be a non-empty array.');
  if (!Array.isArray(uniqueKey) || !uniqueKey.length) throw new Error('Unique key must be a non-empty array.');
  if (!columnMapping || typeof columnMapping !== 'object' || Array.isArray(columnMapping) || !Object.keys(columnMapping).length) throw new Error('Column mapping is required.');
  const mappedCsvColumns = new Set(Object.keys(columnMapping));
  const mappedDbColumns = Object.values(columnMapping);
  mappedDbColumns.forEach((column) => assertSafeIdentifier(column, 'database column'));
  if (requiredColumns.some((column) => !mappedCsvColumns.has(column))) throw new Error('Every required column must exist in the column mapping.');
  if (uniqueKey.some((column) => !mappedCsvColumns.has(column))) throw new Error('Every unique-key column must exist in the column mapping.');
  if (isEnabled !== undefined && typeof isEnabled !== 'boolean') throw new Error('is_enabled must be a boolean.');
  if (dateStrategy === 'fixed' && (!validIsoDate(fixedStartDate) || !validIsoDate(fixedEndDate) || fixedStartDate > fixedEndDate)) {
    throw new Error('Fixed date strategy requires valid fixed_start_date and fixed_end_date values.');
  }
  return { downloadFolder: downloadFolder.trim(), dateStrategy, scheduleCron: scheduleCron || null,
    requiredColumns, uniqueKey, columnMapping, isEnabled: isEnabled ?? true, fixedStartDate, fixedEndDate };
}

async function listReports(req, res, next) {
  try {
    const result = await query('SELECT * FROM report_configs ORDER BY id');
    return res.json(result.rows);
  } catch (error) { return next(error); }
}

async function getReportData(req, res, next) {
  try {
    const { reportName } = req.params;
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const config = await query('SELECT * FROM report_configs WHERE report_name = $1 OR portal_path = $1', [reportName]);
    if (!config.rows.length) return res.status(404).json({ error: 'Report not found.' });
    const report = config.rows[0];
    if (['vehicle_sales', 'service_transactions', 'spare_parts', 'insurance_renewals'].includes(report.report_name)) {
      const table = assertSafeIdentifier(report.report_name, 'report table');
      const data = await query(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
      return res.json({ report, data: data.rows });
    }
    const data = await query(
      'SELECT id, file_id, run_id, record_data AS data, created_at FROM report_records WHERE report_config_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [report.id, limit, offset]
    );
    return res.json({ report, data: data.rows });
  } catch (error) { return next(error); }
}

async function createReport(req, res, next) {
  try {
    const body = req.body || {};
    const config = validateConfigPayload(body);
    if (!body.report_name || !body.portal_path) return res.status(400).json({ error: 'report_name and portal_path are required.' });
    const result = await query(
      `INSERT INTO report_configs
       (report_name, file_pattern, required_columns, unique_key, column_mapping, download_folder,
        date_strategy, portal_path, schedule, is_active, fixed_start_date, fixed_end_date)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [body.report_name, `${body.report_name}_*.csv`, JSON.stringify(config.requiredColumns),
        JSON.stringify(config.uniqueKey), JSON.stringify(config.columnMapping), config.downloadFolder,
        config.dateStrategy, body.portal_path, config.scheduleCron, config.isEnabled,
        config.fixedStartDate, config.fixedEndDate]
    );
    await initializeScheduler();
    return res.status(201).json({ message: 'Report configuration created.', report: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A report with that name or portal path already exists.' });
    if (error.message?.includes('Invalid') || error.message?.includes('required') || error.message?.includes('must')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

async function updateReport(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid report ID.' });
    const config = validateConfigPayload(req.body || {});
    const result = await query(
      `UPDATE report_configs SET download_folder = $1, date_strategy = $2, schedule = $3,
       required_columns = $4::jsonb, unique_key = $5::jsonb, column_mapping = $6::jsonb,
       is_active = $7, fixed_start_date = $8, fixed_end_date = $9
       WHERE id = $10 RETURNING *`,
      [config.downloadFolder, config.dateStrategy, config.scheduleCron,
        JSON.stringify(config.requiredColumns), JSON.stringify(config.uniqueKey),
        JSON.stringify(config.columnMapping), config.isEnabled, config.fixedStartDate,
        config.fixedEndDate, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Report not found.' });
    await initializeScheduler();
    return res.json({ message: 'Report settings updated successfully.', report: result.rows[0] });
  } catch (error) {
    if (error.message?.includes('Invalid') || error.message?.includes('required') || error.message?.includes('must')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

export { listReports, getReportData, createReport, updateReport, validateConfigPayload };
