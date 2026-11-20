'use strict';

const {
  reports,
  getReportData,
  listConfiguredReports,
  getConfiguredReportData,
} = require('../services/report.service');

async function listReports(req, res, next) {
  try {
    const configured = await listConfiguredReports();
    return res.json(configured.map(({ id, name, columns }) => ({ id, name, columns })));
  } catch (error) {
    return next(error);
  }
}

async function previewReport(req, res, next) {
  try {
    const result = await getConfiguredReportData(req.params.reportId, req.query);
    if (result.error) return res.status(result.status).json({ message: result.error });
    return res.json({ ...result.data, count: result.data.rows.length });
  } catch (error) {
    return next(error);
  }
}

function escapeCSV(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function downloadReport(req, res, next) {
  try {
    if (req.query.scenario === 'timeout') {
      return res.status(504).json({ message: 'Simulated report download timeout.' });
    }
    const result = await getConfiguredReportData(req.params.reportId, req.query);
    if (result.error) return res.status(result.status).json({ message: result.error });

    const { report, columns, rows } = result.data;
    const lines = [
      columns.map(escapeCSV).join(','),
      ...rows.map((row) => columns.map((column) => escapeCSV(row[column])).join(',')),
    ];
    const { startDate, endDate } = req.query;
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const timestamp = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
    const runTimestamp = `${timestamp.year}${timestamp.month}${timestamp.day}-${timestamp.hour}${timestamp.minute}`;
    const fileName = `${report.reportName}_${startDate}_to_${endDate}_run-${runTimestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send('\uFEFF' + lines.join('\r\n'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { listReports, previewReport, downloadReport };
