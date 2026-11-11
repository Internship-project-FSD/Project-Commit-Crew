'use strict';

const {
  reports,
  getReportData
} = require('../services/report.service');

function listReports(req, res) {
  res.json(
    reports.map(({ id, name, columns }) => ({
      id,
      name,
      columns
    }))
  );
}

function previewReport(req, res) {
  const result = getReportData(
    req.params.reportId,
    req.query
  );

  if (result.error) {
    return res.status(result.status).json({
      message: result.error
    });
  }

  return res.json({
    ...result.data,
    count: result.data.rows.length
  });
}

function escapeCSV(value) {
  const text = String(value ?? '');

  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function downloadReport(req, res) {
  const result = getReportData(
    req.params.reportId,
    req.query
  );

  if (result.error) {
    return res.status(result.status).json({
      message: result.error
    });
  }

  const { report, columns, rows } = result.data;

  const lines = [
    columns.map(escapeCSV).join(','),
    ...rows.map((row) =>
      columns.map((column) => escapeCSV(row[column])).join(',')
    )
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');

 const { startDate, endDate } = req.query;

const runTimestamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 12);

const fileName = `${report.reportName}_${startDate}_to_${endDate}_run-${runTimestamp}.csv`;

res.setHeader(
  'Content-Disposition',
  `attachment; filename="${fileName}"`
);

  return res.send('\uFEFF' + lines.join('\r\n'));
}

module.exports = {listReports, previewReport, downloadReport};