import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, Clock3, FileText, Info, ListChecks, Server, ShieldAlert, XCircle } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, formatDuration, formatNumber, sanitizeText } from '../utils/format.js';

function CountTile({ label, value, tone }) {
  return <div className={`detail-count detail-count-${tone}`}><span>{label}</span><strong>{formatNumber(value)}</strong></div>;
}

function severityClass(severity) {
  const value = String(severity || 'info').toLowerCase();
  return ['error', 'warn', 'warning'].includes(value) ? value : 'info';
}

export default function RunDetails({ detail, loading, error, onBack, onSelectFile }) {
  if (loading) return <div className="page-loading"><div className="spinner" />Loading run details…</div>;
  if (error) return <div className="state-card error-state"><AlertTriangle size={22} /><h3>Could not load run details</h3><p>{error}</p><button className="button button-secondary" onClick={onBack}>Back to run history</button></div>;
  if (!detail) return null;

  const run = detail.run;
  const reports = detail.reports || run.reports || [];
  const files = detail.files || run.files || [];
  const rejectedRows = detail.rejectedRows || [];
  const logs = detail.logs || [];

  return (
    <div className="run-detail-page">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to run history</button>
      <div className="detail-heading-row">
        <div><div className="eyebrow">AUTOMATION RUN</div><h1>{run.id}</h1><p>Run details, report outcomes and processing logs.</p></div>
        <StatusBadge status={run.status} />
      </div>
      <div className="detail-summary-grid">
        <div className="detail-summary-card"><span><CalendarDays size={14} /> Started</span><strong>{formatDateTime(run.startedAt)}</strong></div>
        <div className="detail-summary-card"><span><Clock3 size={14} /> Completed</span><strong>{run.endedAt ? formatDateTime(run.endedAt) : 'Still running'}</strong></div>
        <div className="detail-summary-card"><span><Clock3 size={14} /> Duration</span><strong>{formatDuration(run.startedAt, run.endedAt)}</strong></div>
        <div className="detail-summary-card"><span><Server size={14} /> Trigger</span><strong className="capitalize">{run.triggerLabel}</strong></div>
      </div>
      <section className="panel detail-count-panel">
        <div className="panel-heading"><div><h2>Import summary</h2><p>Record counts returned by the processing pipeline.</p></div></div>
        <div className="detail-count-grid">
          <CountTile label="Rows read" value={run.rowsRead} tone="blue" />
          <CountTile label="Rows loaded" value={run.rowsLoaded} tone="green" />
          <CountTile label="Duplicates skipped" value={run.rowsSkipped} tone="amber" />
          <CountTile label="Rows rejected" value={run.rowsRejected} tone="red" />
        </div>
      </section>
      <section className="panel detail-section">
        <div className="panel-heading"><div><h2>Report processing</h2><p>Outcome for each configured report included in this run.</p></div><span className="section-counter">{reports.length} reports</span></div>
        {reports.length === 0 ? <div className="empty-panel"><Info size={18} /> No report-level results were returned for this run.</div> : <div className="report-result-list">{reports.map((report, i) => (
          <div className="report-result-row" key={report.id || report.reportId || report.report_id || i}>
            <div className="report-result-main"><span className="report-result-index">0{i + 1}</span><div><strong>{report.name || report.reportName || report.report_name || report.report || `Report ${i + 1}`}</strong><span>{report.fileName || report.file_name || report.fileId || report.file_id || 'File details not supplied'}</span></div></div>
            <div className="report-result-counts"><span><strong>{formatNumber(report.rowsLoaded ?? report.rows_loaded)}</strong> loaded</span><span><strong>{formatNumber(report.rowsRejected ?? report.rows_rejected)}</strong> rejected</span></div>
            <StatusBadge status={report.status} compact />
            {(report.error || report.message) && <div className="report-result-error"><AlertTriangle size={14} />{sanitizeText(report.error || report.message)}</div>}
          </div>
        ))}</div>}
      </section>
      <div className="detail-two-col">
        <section className="panel detail-section">
          <div className="panel-heading"><div><h2>Downloaded files</h2><p>Source file records associated with this run.</p></div><span className="section-counter">{files.length} files</span></div>
          {files.length === 0 ? <div className="empty-panel"><FileText size={18} /> No file records were returned.</div> : <div className="file-list">{files.map((file, i) => (
            <div className="file-list-item" key={file.id || file.fileId || file.file_id || i}><div className="file-icon"><FileText size={17} /></div><div className="file-list-copy"><strong>{file.name || file.fileName || file.file_name || file.file_id || 'CSV report file'}</strong><span>{file.reportName || file.report_name || 'Report file'} · {file.size ? `${formatNumber(file.size)} bytes` : file.size_bytes ? `${(Number(file.size_bytes) / 1024).toFixed(1)} KB` : 'Size not supplied'}</span></div><StatusBadge compact status={file.status || 'unknown'} />{(file.id || file.fileId || file.file_id) && <button type="button" className="file-view-button" onClick={() => onSelectFile?.(file.id || file.fileId || file.file_id)}>Details</button>}</div>
          ))}</div>}
        </section>
        <section className="panel detail-section">
          <div className="panel-heading"><div><h2>Rejected rows</h2><p>Rows excluded from the final import.</p></div><span className="section-counter">{rejectedRows.length} shown</span></div>
          {rejectedRows.length === 0 ? <div className="success-empty"><CheckCircle2 size={19} /><span>No rejected-row details were returned.</span></div> : <div className="rejected-list">{rejectedRows.map((row, i) => <div className="rejected-item" key={row.id || i}><span className="rejected-row-number">Row {row.rowNumber ?? row.row_number ?? i + 1}</span><div><strong>{row.reportName || row.report_name || 'Report row'}</strong><p>{sanitizeText(row.reason || row.rejectionReason || row.rejection_reason || 'No rejection reason supplied.')}</p></div></div>)}</div>}
        </section>
      </div>
      <section className="panel detail-section logs-panel">
        <div className="panel-heading"><div><h2>Run activity log</h2><p>Processing events and errors recorded by the backend.</p></div><span className="section-counter">{logs.length} events</span></div>
        {logs.length === 0 ? <div className="empty-panel"><ListChecks size={18} /> No log entries were returned.</div> : <div className="log-list">{logs.map((log, i) => {
          const level = severityClass(log.severity || log.level);
          const Icon = level === 'error' ? XCircle : level === 'warn' || level === 'warning' ? ShieldAlert : CircleAlert;
          return <div className="log-row" key={log.id || log.logId || log.log_id || i}><span className={`log-level-icon log-${level}`}><Icon size={15} /></span><div className="log-row-content"><div><strong>{log.stage || log.processingStage || log.processing_stage || 'System'}</strong><span className={`log-level-text text-${level}`}>{String(log.severity || log.level || 'INFO').toUpperCase()}</span></div><p>{sanitizeText(log.message || log.description || 'No message supplied.')}</p></div><time>{formatDateTime(log.timestamp || log.createdAt || log.created_at)}</time></div>;
        })}</div>}
      </section>
      <div className="detail-security-note"><ShieldAlert size={15} /> Sensitive values such as passwords, session cookies and connection strings are not displayed.</div>
    </div>
  );
}
