import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, CircleHelp,
  Clock3, FileCheck2, FileClock, Files, Gauge, Layers3, Play, Plus, RefreshCw, Rows3,
  Server, ShieldCheck, SlidersHorizontal, TimerReset, Wrench, X,
} from 'lucide-react';
import { api, extractArray, extractData, isDemoMode } from './api/client.js';
import { useAuth } from './auth/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import MetricCard from './components/MetricCard.jsx';
import RunTable from './components/RunTable.jsx';
import ReportCards from './components/ReportCards.jsx';
import RunNowModal from './components/RunNowModal.jsx';
import RunDetails from './components/RunDetails.jsx';
import StatusBadge from './components/StatusBadge.jsx';
import {
  errorMessage, firstValue, formatDate, formatDateTime, formatNumber, normalizeStatus,
  sanitizeText,
} from './utils/format.js';

const REPORT_NAMES = [
  'Vehicle Sales & Purchases',
  'Service Transactions',
  'Spare Parts Sales & Purchases',
  'Insurance Renewals',
];

function normalizeReport(raw, index = 0) {
  const id = firstValue(raw, ['report_id', 'id', 'reportId'], `report-${index + 1}`);
  const name = firstValue(raw, ['name', 'report_name', 'reportName', 'title'], REPORT_NAMES[index] || `Report ${index + 1}`);
  return {
    id: String(id),
    name,
    portalPath: firstValue(raw, ['portal_path', 'portalPath', 'route'], ''),
    downloadFolder: firstValue(raw, ['download_folder', 'downloadFolder', 'folder'], ''),
    dateStrategy: firstValue(raw, ['date_strategy', 'dateStrategy', 'date_range_strategy'], 'yesterday'),
    scheduleCron: firstValue(raw, ['schedule_cron', 'scheduleCron', 'cron'], ''),
    requiredColumns: firstValue(raw, ['required_columns', 'requiredColumns'], []),
    uniqueKey: firstValue(raw, ['unique_key', 'uniqueKey'], []),
    columnMapping: firstValue(raw, ['column_mapping', 'columnMapping', 'mapping'], {}),
    enabled: firstValue(raw, ['enabled', 'is_enabled', 'isEnabled'], true) !== false,
    lastStatus: firstValue(raw, ['last_status', 'lastStatus', 'status'], 'unknown'),
    lastRunAt: firstValue(raw, ['last_run_at', 'lastRunAt'], null),
    rowsLoaded: Number(firstValue(raw, ['rows_loaded', 'rowsLoaded'], 0)) || 0,
  };
}

function normalizeRun(raw, index = 0) {
  const id = firstValue(raw, ['run_id', 'id', 'runId'], `run-${index + 1}`);
  const trigger = String(firstValue(raw, ['trigger', 'trigger_type', 'triggerType', 'source'], 'manual')).toLowerCase();
  const reports = firstValue(raw, ['reports', 'report_results', 'reportResults'], []);
  const rows = firstValue(raw, ['counts', 'summary', 'row_counts'], {}) || {};
  return {
    id: String(id),
    startedAt: firstValue(raw, ['started_at', 'startedAt', 'start_time', 'startTime'], null),
    endedAt: firstValue(raw, ['ended_at', 'endedAt', 'end_time', 'endTime', 'completed_at'], null),
    trigger: trigger.includes('sched') ? 'schedule' : 'manual',
    triggerLabel: trigger.includes('sched') ? 'Scheduled' : 'Manual',
    status: firstValue(raw, ['status', 'run_status', 'runStatus'], 'unknown'),
    rowsRead: Number(firstValue(raw, ['rows_read', 'rowsRead'], firstValue(rows, ['rows_read', 'read'], 0))) || 0,
    rowsLoaded: Number(firstValue(raw, ['rows_loaded', 'rowsLoaded', 'records_loaded'], firstValue(rows, ['rows_loaded', 'loaded'], 0))) || 0,
    rowsSkipped: Number(firstValue(raw, ['rows_skipped', 'rowsSkipped', 'duplicates_skipped'], firstValue(rows, ['rows_skipped', 'skipped'], 0))) || 0,
    rowsRejected: Number(firstValue(raw, ['rows_rejected', 'rowsRejected'], firstValue(rows, ['rows_rejected', 'rejected'], 0))) || 0,
    reports: Array.isArray(reports) ? reports : [],
    reportCount: Array.isArray(reports) ? reports.length : Number(firstValue(raw, ['reports_processed', 'reportsProcessed'], 0)) || 0,
  };
}

function normalizeRunDetail(response) {
  const data = extractData(response) || {};
  const rawRun = data.run || data.execution || data;
  const run = normalizeRun(rawRun);
  const reports = firstValue(data, ['reports', 'report_results', 'reportResults'], run.reports) || [];
  const files = firstValue(data, ['files', 'file_records', 'fileRecords'], rawRun.files || []) || [];
  const rejectedRows = firstValue(data, ['rejected_rows', 'rejectedRows', 'invalid_rows'], []) || [];
  const logs = firstValue(data, ['logs', 'run_logs', 'runLogs', 'messages'], []) || [];
  return { run, reports, files, rejectedRows, logs };
}

function healthState(response) {
  const data = extractData(response) || {};
  const raw = String(data.status || data.service || data.health || '').toLowerCase();
  const explicitlyUnavailable = ['unhealthy', 'failed', 'failure', 'error', 'down', 'unavailable'].includes(raw) || data.success === false || data.ok === false;
  // A resolved GET /api/health response confirms the API is reachable unless it explicitly reports an unhealthy state.
  const ok = !explicitlyUnavailable;
  const databaseRaw = data.database;
  const databaseState = typeof databaseRaw === 'object' && databaseRaw ? String(databaseRaw.status || databaseRaw.state || '').toLowerCase() : String(databaseRaw || '').toLowerCase();
  const databaseConnected = ['connected', 'ok', 'healthy', 'up'].includes(databaseState) || (typeof databaseRaw === 'object' && databaseRaw?.connected === true) ? true : ['disconnected', 'error', 'down', 'unavailable'].includes(databaseState) || (typeof databaseRaw === 'object' && databaseRaw?.connected === false) ? false : null;
  return { ok, databaseConnected, data };
}

function currentDateLabel() {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase();
}

function PageHeading({ eyebrow, title, subtitle, children }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="page-heading-actions">{children}</div>}</div>;
}

function PanelHeading({ title, subtitle, action }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function OverviewPage({ reports, runs, latestByReport, stats, health, loading, onSelectRun, onViewRuns, onManageReport, canManage }) {
  const recentRuns = runs.slice(0, 5);
  const chartData = runs.slice(0, 7).reverse();
  const maxRows = Math.max(1, ...chartData.map((r) => r.rowsLoaded));
  return (
    <>
      <PageHeading eyebrow="DEALERSHIP OPERATIONS" title="Automation overview" subtitle="Monitor report imports, review exceptions and control automation runs from one workspace.">
        <div className="last-updated"><span className="live-pulse" /> Live monitoring <span className="last-updated-separator">·</span> Updated just now</div>
      </PageHeading>
      <section className="overview-hero" aria-label="Dealership automation control center">
        <div className="overview-hero-copy">
          <div className="hero-kicker"><span className="hero-kicker-mark" /> DEALERSHIP OPERATIONS / CONTROL CENTER</div>
          <h2>Precision in every <em>report run.</em></h2>
          <p>Four report streams. One clear view of what has moved, what needs attention, and what is ready for the next run.</p>
          <div className="hero-meta-row">
            <div className="hero-meta-item"><span>REPORT STREAMS</span><strong>04</strong></div>
            <div className="hero-meta-divider" />
            <div className="hero-meta-item"><span>WORKSPACE</span><strong>KERALA DEMO MOTORS</strong></div>
          </div>
        </div>
      </section>
      <div className="overview-kpis">
        <MetricCard label="Total automation runs" value={formatNumber(stats.total)} note="Runs in retrieved history" icon={Activity} tone="blue" />
        <MetricCard label="Successful runs" value={formatNumber(stats.success)} note="All configured reports completed" icon={CheckCircle2} tone="green" />
        <MetricCard label="Partial runs" value={formatNumber(stats.partial)} note="Completed with report issues" icon={AlertTriangle} tone="amber" />
        <MetricCard label="Failed runs" value={formatNumber(stats.failed)} note="Critical run failures" icon={AlertCircle} tone="red" />
        <MetricCard label="Reports processed" value={formatNumber(stats.reportsProcessed)} note="Successful or partial report tasks" icon={FileCheck2} tone="violet" />
      </div>
      <div className="overview-main-grid">
        <section className="panel activity-panel">
          <PanelHeading title="Run activity" subtitle="Rows successfully loaded per recent run" action={<button className="subtle-select" type="button"><span className="select-dot" /> Recent runs</button>} />
          <div className="activity-summary"><div><strong>{formatNumber(runs.reduce((sum, r) => sum + r.rowsLoaded, 0))}</strong><span>Rows loaded in history</span></div><div className="activity-mini-legend"><i /> Loaded rows</div></div>
          {loading ? <div className="chart-empty">Loading activity…</div> : chartData.length === 0 ? <div className="chart-empty">Run history will appear here after the first automation.</div> : (
            <div className="activity-chart" aria-label="Rows loaded for recent runs">
              <div className="chart-y-labels"><span>{formatNumber(maxRows)}</span><span>{formatNumber(Math.round(maxRows / 2))}</span><span>0</span></div>
              <div className="chart-bars">{chartData.map((run) => <div className="chart-bar-column" key={run.id}><div className="chart-bar-track"><div className={`chart-bar-fill ${normalizeStatus(run.status)}`} style={{ height: `${Math.max(4, (run.rowsLoaded / maxRows) * 100)}%` }} title={`${run.rowsLoaded} rows loaded`} /></div><span>{formatDate(run.startedAt, { day: '2-digit', month: 'short' })}</span></div>)}</div>
            </div>
          )}
          <div className="activity-foot"><span><span className="status-dot dot-success" /> Success</span><span><span className="status-dot dot-partial" /> Partial</span><span><span className="status-dot dot-failed" /> Failed</span></div>
        </section>
        <section className="panel system-panel">
          <PanelHeading title="System status" subtitle="Connected services" />
          <div className="system-status-row"><div className="system-icon"><Server size={17} /></div><div><strong>Express API</strong><span>Dashboard service</span></div><span className={`system-state ${health?.ok ? 'state-online' : 'state-offline'}`}>{health?.ok ? 'Online' : 'Unavailable'}</span></div>
          <div className="system-status-row"><div className="system-icon db"><Layers3 size={17} /></div><div><strong>PostgreSQL</strong><span>Report database</span></div><span className={`system-state ${health?.databaseConnected === true ? 'state-online' : health?.databaseConnected === false ? 'state-offline' : 'state-unreported'}`}>{health?.databaseConnected === true ? 'Connected' : health?.databaseConnected === false ? 'Unavailable' : 'Not reported'}</span></div>
          <div className="system-status-row"><div className="system-icon browser"><Activity size={17} /></div><div><strong>Automation engine</strong><span>Playwright worker</span></div><span className="system-state state-unreported">Not reported</span></div>
          <div className="system-panel-foot"><ShieldCheck size={15} /> Service status is read from the API health endpoint.</div>
        </section>
      </div>
      <section className="panel report-status-panel">
        <PanelHeading title="Report status" subtitle="Latest processing result for each configured report" action={<button className="text-link" type="button" onClick={() => onManageReport(null)}>View report settings <ArrowRight size={14} /></button>} />
        <ReportCards reports={reports} latestByReport={latestByReport} canManage={canManage} onManage={onManageReport} compact />
      </section>
      <section className="panel recent-runs-panel">
        <PanelHeading title="Recent automation runs" subtitle="Review the latest executions and their outcomes" action={<button className="text-link" type="button" onClick={onViewRuns}>View all runs <ArrowRight size={14} /></button>} />
        <RunTable runs={recentRuns} onSelect={onSelectRun} compact loading={loading} />
      </section>
    </>
  );
}

function RunsPage({ runs, loading, onSelectRun, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => runs.filter((run) => {
    const matchesFilter = filter === 'all' || normalizeStatus(run.status) === filter;
    return matchesFilter && (run.id.toLowerCase().includes(search.toLowerCase()) || run.triggerLabel.toLowerCase().includes(search.toLowerCase()));
  }), [runs, filter, search]);
  return <>
    <PageHeading eyebrow="EXECUTION MONITOR" title="Run history" subtitle="Track every manual and scheduled automation run, including partial and failed executions.">
      <button className="button button-secondary" type="button" onClick={onRefresh}><RefreshCw size={15} /> Refresh</button>
    </PageHeading>
    <div className="runs-toolbar"><div className="filter-tabs">{[['all', 'All runs'], ['success', 'Success'], ['partial', 'Partial'], ['failed', 'Failed'], ['running', 'Running']].map(([id, label]) => <button type="button" key={id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{label}{id === 'all' && <span>{runs.length}</span>}</button>)}</div><div className="table-search"><SlidersHorizontal size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search run ID or trigger" /></div></div>
    <section className="panel run-history-panel"><PanelHeading title="All runs" subtitle={`${filtered.length} executions shown`} /><RunTable runs={filtered} onSelect={onSelectRun} loading={loading} /></section>
  </>;
}

function ReportSettingsPage({ reports, latestByReport, canManage, onEdit }) {
  return <>
    <PageHeading eyebrow="CONFIGURATION" title="Report settings" subtitle="Manage report folders, date strategies, schedules and validation mappings.">
      <span className="read-only-label"><ShieldCheck size={14} /> {canManage ? 'Admin access' : 'Read-only access'}</span>
    </PageHeading>
    <div className="settings-callout"><div className="callout-icon"><InfoIcon /></div><div><strong>Configuration controls the automation engine</strong><p>Changes are saved through the Express API and are applied by the backend on the next scheduled or manual run.</p></div></div>
    <div className="settings-report-list">{reports.map((report, index) => {
      const last = latestByReport[report.id] || {};
      return <article className="settings-report-card" key={report.id}>
        <div className="settings-card-top"><div className="settings-report-title"><div className={`report-icon report-icon-${index % 4}`}><FileCheck2 size={18} /></div><div><h3>{report.name}</h3><span>{report.portalPath || 'Report path not supplied'}</span></div></div><div className="settings-card-top-right"><span className={`enabled-pill ${report.enabled ? 'enabled' : 'disabled'}`}><i />{report.enabled ? 'Enabled' : 'Disabled'}</span><StatusBadge status={last.status || report.lastStatus} compact /></div></div>
        <div className="settings-fields-grid"><div><span>Download folder</span><strong className="mono-text">{report.downloadFolder || 'Not configured'}</strong></div><div><span>Date strategy</span><strong>{String(report.dateStrategy || 'Not set').replaceAll('_', ' ')}</strong></div><div><span>Schedule (cron)</span><strong className="mono-text">{report.scheduleCron || 'Not scheduled'}</strong></div><div><span>Unique key</span><strong>{Array.isArray(report.uniqueKey) ? report.uniqueKey.join(', ') : report.uniqueKey || 'Not configured'}</strong></div></div>
        <div className="settings-card-footer"><span>Last processed {last.startedAt || report.lastRunAt ? formatDateTime(last.startedAt || report.lastRunAt) : '—'} <b>·</b> {formatNumber(last.rowsLoaded ?? report.rowsLoaded)} rows loaded</span><button type="button" className="button button-secondary button-small" disabled={!canManage} onClick={() => onEdit(report)}>{canManage ? 'Edit settings' : 'View only'} <ArrowRight size={14} /></button></div>
      </article>;
    })}</div>
  </>;
}

function InfoIcon() { return <CircleHelp size={19} />; }

function ReportEditModal({ report, onClose, onSave, saving }) {
  const [folder, setFolder] = useState(report.downloadFolder || '');
  const [dateStrategy, setDateStrategy] = useState(report.dateStrategy || 'yesterday');
  const [scheduleCron, setScheduleCron] = useState(report.scheduleCron || '');
  const [columns, setColumns] = useState(Array.isArray(report.requiredColumns) ? report.requiredColumns.join(', ') : String(report.requiredColumns || ''));
  const [uniqueKey, setUniqueKey] = useState(Array.isArray(report.uniqueKey) ? report.uniqueKey.join(', ') : String(report.uniqueKey || ''));
  const [mapping, setMapping] = useState(JSON.stringify(report.columnMapping || {}, null, 2));
  const [enabled, setEnabled] = useState(report.enabled);
  const [formError, setFormError] = useState('');

  function save(event) {
    event.preventDefault();
    let parsedMapping;
    try { parsedMapping = JSON.parse(mapping || '{}'); }
    catch { setFormError('Column mapping must be valid JSON.'); return; }
    if (typeof parsedMapping !== 'object' || Array.isArray(parsedMapping) || parsedMapping === null) {
      setFormError('Column mapping must be a JSON object.'); return;
    }
    onSave({
      download_folder: folder.trim(),
      date_strategy: dateStrategy,
      schedule_cron: scheduleCron.trim() || null,
      required_columns: columns.split(',').map((v) => v.trim()).filter(Boolean),
      unique_key: uniqueKey.split(',').map((v) => v.trim()).filter(Boolean),
      column_mapping: parsedMapping,
      is_enabled: enabled,
    });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}><section className="modal config-modal" role="dialog" aria-modal="true" aria-labelledby="config-title">
    <div className="modal-head"><div><div className="modal-icon blue"><SlidersHorizontal size={18} /></div><div><h2 id="config-title">Edit report settings</h2><p>{report.name}</p></div></div><button className="icon-button" type="button" onClick={onClose} disabled={saving}><X size={18} /></button></div>
    <form onSubmit={save}>
      <div className="form-grid two-col"><div className="full-field"><label className="field-label" htmlFor="report-folder">Download folder</label><input id="report-folder" className="text-input" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="downloads/vehicle_sales" required /></div>
        <div><label className="field-label" htmlFor="date-strategy">Date range strategy</label><select id="date-strategy" className="text-input" value={dateStrategy} onChange={(e) => setDateStrategy(e.target.value)}><option value="yesterday">Yesterday</option><option value="last_7_days">Last 7 days</option><option value="last_30_days">Last 30 days</option><option value="fixed">Fixed dates</option></select></div>
        <div><label className="field-label" htmlFor="cron-schedule">Schedule (cron expression)</label><input id="cron-schedule" className="text-input mono-text" value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} placeholder="0 6 * * *" /></div>
        <div className="full-field"><label className="field-label" htmlFor="required-columns">Required CSV columns <small>Comma-separated</small></label><input id="required-columns" className="text-input" value={columns} onChange={(e) => setColumns(e.target.value)} placeholder="InvoiceNo, InvoiceDate, Amount" /></div>
        <div className="full-field"><label className="field-label" htmlFor="unique-key">Unique key <small>Comma-separated</small></label><input id="unique-key" className="text-input" value={uniqueKey} onChange={(e) => setUniqueKey(e.target.value)} placeholder="InvoiceNo" /></div>
        <div className="full-field"><label className="field-label" htmlFor="column-mapping">Column mapping <small>JSON object · CSV column to database column</small></label><textarea id="column-mapping" className="text-input mapping-textarea" rows="5" value={mapping} onChange={(e) => setMapping(e.target.value)} spellCheck="false" /></div>
      </div>
      <label className="toggle-row"><span><strong>Include in automation</strong><small>Disabled reports are skipped by scheduled runs.</small></span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /><i /></label>
      {formError && <div className="inline-error">{formError}</div>}
      <div className="modal-info"><span className="info-dot">i</span><p>Editable fields follow the report configuration described in the SRS and system design. Confirm field names and accepted values with Member 2 before connecting.</p></div>
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</button></div>
    </form>
  </section></div>;
}


function FileMetadataModal({ metadata, loading, error, onClose }) {
  const file = metadata?.file || metadata || {};
  const entries = [
    ['File ID', file.file_id || file.fileId || file.id],
    ['File name', file.name || file.file_name || file.fileName],
    ['Report', file.report_name || file.reportName || file.report_type],
    ['Status', file.status],
    ['Size', file.size_bytes ? `${formatNumber(file.size_bytes)} bytes` : file.size],
    ['Downloaded at', file.downloaded_at || file.downloadedAt],
    ['SHA-256', file.sha256 || file.file_hash || file.hash],
    ['Run ID', file.run_id || file.runId],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal file-modal" role="dialog" aria-modal="true" aria-labelledby="file-modal-title"><div className="modal-head"><div><div className="modal-icon blue"><Files size={18} /></div><div><h2 id="file-modal-title">File metadata</h2><p>Metadata returned by the backend file endpoint.</p></div></div><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></div>{loading ? <div className="page-loading"><div className="spinner" />Loading file metadata…</div> : error ? <div className="inline-error">{error}</div> : <div className="file-metadata-grid">{entries.length ? entries.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === 'SHA-256' ? 'hash-value' : ''}>{String(value)}</strong></div>) : <div className="empty-panel">No file metadata fields were returned.</div>}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Close</button></div></section></div>;
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}</span><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button type="button" onClick={onClose} aria-label="Dismiss"><X size={15} /></button></div>;
}

export default function App() {
  const { user, login, logout, checking, authError, setAuthError } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginEmail, setLoginEmail] = useState(isDemoMode ? 'admin@dms.local' : '');
  const [loginPassword, setLoginPassword] = useState(isDemoMode ? 'demo1234' : '');
  const [activePage, setActivePage] = useState('overview');
  const [reports, setReports] = useState([]);
  const [runs, setRuns] = useState([]);
  const [latestByReport, setLatestByReport] = useState({});
  const [health, setHealth] = useState({ ok: false, data: {} });
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runDetail, setRunDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [toast, setToast] = useState(null);
  const [fileMetadata, setFileMetadata] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');

  const isAdmin = user?.role === 'admin';

  const refresh = useCallback(async (showSpinner = false) => {
    if (!user) return;
    if (showSpinner) setLoading(true);
    const [reportsResult, runsResult, healthResult] = await Promise.allSettled([
      api.getReports(), api.getRuns({ limit: 50 }), api.getHealth(),
    ]);
    let anyOk = false;
    if (reportsResult.status === 'fulfilled') {
      const list = extractArray(reportsResult.value, ['reports', 'items']).map(normalizeReport);
      setReports(list);
      anyOk = true;
    }
    if (runsResult.status === 'fulfilled') {
      const list = extractArray(runsResult.value, ['runs', 'items']).map(normalizeRun);
      setRuns(list);
      const latest = {};
      [...list].sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)).forEach((run) => {
        run.reports.forEach((report) => {
          const id = String(firstValue(report, ['report_id', 'reportId', 'id'], ''));
          if (!id || latest[id]) return;
          latest[id] = {
            status: firstValue(report, ['status', 'report_status'], 'unknown'),
            rowsLoaded: Number(firstValue(report, ['rows_loaded', 'rowsLoaded'], 0)) || 0,
            startedAt: run.startedAt,
          };
        });
      });
      setLatestByReport(latest);
      anyOk = true;
    }
    if (healthResult.status === 'fulfilled') {
      setHealth(healthState(healthResult.value));
      anyOk = true;
    } else {
      setHealth({ ok: false, data: {} });
    }
    const failures = [reportsResult, runsResult].filter((r) => r.status === 'rejected');
    if (failures.length) setRefreshError(failures.map((f) => errorMessage(f.reason)).join(' · '));
    else setRefreshError('');
    if (!anyOk && !isDemoMode) setHealth({ ok: false, data: {} });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    refresh(true);
    const interval = window.setInterval(() => refresh(false), 12000);
    return () => window.clearInterval(interval);
  }, [user, refresh]);

  const stats = useMemo(() => {
    const success = runs.filter((r) => normalizeStatus(r.status) === 'success').length;
    const partial = runs.filter((r) => normalizeStatus(r.status) === 'partial').length;
    const failed = runs.filter((r) => normalizeStatus(r.status) === 'failed').length;
    const reportsProcessed = runs.reduce((sum, run) => {
      if (run.reports.length) return sum + run.reports.filter((r) => ['success', 'partial'].includes(normalizeStatus(firstValue(r, ['status', 'report_status'])))).length;
      return sum + (run.reportCount || 0);
    }, 0);
    return { total: runs.length, success, partial, failed, reportsProcessed };
  }, [runs]);

  // Notifications are derived from run history because the documented API does not define
  // a separate notifications endpoint. Selecting one opens the corresponding run details.
  const notifications = useMemo(() => runs
    .map((run) => {
      const runStatus = normalizeStatus(run.status);
      const issueReports = (run.reports || []).filter((report) => {
        const reportStatus = normalizeStatus(firstValue(report, ['status', 'report_status', 'reportStatus']));
        const rejected = Number(firstValue(report, ['rows_rejected', 'rowsRejected'], 0)) || 0;
        return ['partial', 'failed'].includes(reportStatus) || rejected > 0;
      });
      const rejectedRows = Number(run.rowsRejected || 0) || issueReports.reduce((sum, report) => sum + (Number(firstValue(report, ['rows_rejected', 'rowsRejected'], 0)) || 0), 0);
      let notification = null;

      if (runStatus === 'failed') {
        notification = { status: 'failed', title: 'Automation run failed', message: 'This run did not complete. Open the details to review the failure.' };
      } else if (runStatus === 'partial') {
        const reportLabel = issueReports.length === 1 ? '1 report needs attention' : `${issueReports.length || 'Some'} reports need attention`;
        const rowLabel = rejectedRows ? `${formatNumber(rejectedRows)} rows rejected` : 'Review the report-level results';
        notification = { status: 'partial', title: 'Run partially completed', message: `${reportLabel} · ${rowLabel}.` };
      } else if (runStatus === 'running' || runStatus === 'queued') {
        notification = { status: runStatus, title: runStatus === 'queued' ? 'Automation run queued' : 'Automation run in progress', message: 'This run has not completed yet. Open it to check the latest status.' };
      } else if (rejectedRows > 0 || issueReports.length > 0) {
        notification = { status: 'partial', title: 'Rejected rows need review', message: `${formatNumber(rejectedRows)} rows were rejected during this run.` };
      }

      return notification ? { ...notification, id: `${run.id}:${runStatus}:${rejectedRows}`, runId: run.id, startedAt: run.startedAt } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)), [runs]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try { await login({ email: loginEmail, username: loginEmail, password: loginPassword }); }
    catch (error) { setLoginError(errorMessage(error)); }
    finally { setLoggingIn(false); }
  }

  async function openRun(id) {
    if (id === '__all__') { setActivePage('runs'); return; }
    setSelectedRunId(id);
    setActivePage('detail');
    setDetailLoading(true);
    setDetailError('');
    setRunDetail(null);
    try {
      const response = await api.getRun(id);
      setRunDetail(normalizeRunDetail(response));
    } catch (error) { setDetailError(errorMessage(error)); }
    finally { setDetailLoading(false); }
  }

  async function handleStartRun(payload) {
    setStartingRun(true);
    try {
      const requestBody = {
        ...(payload.reportId ? { reportId: payload.reportId } : {}),
        dateRange: { startDate: payload.startDate, endDate: payload.endDate },
      };
      const response = extractData(await api.startRun(requestBody)) || {};
      const runId = firstValue(response, ['run_id', 'runId', 'id'], firstValue(response.run || {}, ['run_id', 'runId', 'id'], null));
      setRunModalOpen(false);
      setToast({ type: 'success', title: 'Automation run started', message: runId ? `Run ${runId} has been accepted by the backend.` : 'The backend accepted the run request.' });
      await refresh(false);
      if (runId) openRun(String(runId));
      else setActivePage('runs');
    } catch (error) {
      setToast({ type: 'error', title: 'Could not start run', message: errorMessage(error) });
    } finally { setStartingRun(false); }
  }

  async function openFileMetadata(id) {
    setFileLoading(true); setFileError(''); setFileMetadata(null);
    try { setFileMetadata(extractData(await api.getFile(id)) || {}); }
    catch (error) { setFileError(errorMessage(error)); }
    finally { setFileLoading(false); }
  }

  async function handleSaveReport(payload) {
    setSavingReport(true);
    try {
      await api.updateReport(editReport.id, payload);
      setToast({ type: 'success', title: 'Configuration saved', message: `${editReport.name} settings were updated.` });
      setEditReport(null);
      await refresh(false);
    } catch (error) {
      setToast({ type: 'error', title: 'Configuration not saved', message: errorMessage(error) });
    } finally { setSavingReport(false); }
  }

  async function handleLogout() {
    await logout();
    setReports([]); setRuns([]); setRunDetail(null); setActivePage('overview');
  }

  function openReportSettings(report) {
    if (report) setEditReport(report);
    else setActivePage('reports');
  }

  if (checking) return <div className="auth-loading"><div className="spinner" /><span>Checking dashboard session…</span></div>;

  if (!user) return <div className="login-screen">
    <div className="login-visual">
      <div className="login-brand"><div className="brand-mark"><Activity size={20} /></div><strong>DMS<span>Ops</span></strong></div>
      <div className="login-visual-content"><span className="login-kicker"><i /> DEALERSHIP REPORT AUTOMATION</span><h1>Every report.<br /><em>One clear view.</em></h1><p>Automate routine DMS reporting, track every import and resolve issues from one operations workspace.</p>
        <div className="login-visual-stat-grid"><div><strong>04</strong><span>Configured reports</span></div><div><strong>24/7</strong><span>Run visibility</span></div><div><strong>100%</strong><span>Traceable imports</span></div></div>
      </div>
      <div className="login-visual-footer"><span>ICT ACADEMY OF KERALA · BATCH 06</span><span>MOCK ENVIRONMENT ONLY</span></div>
      <div className="login-visual-orb orb-one" /><div className="login-visual-orb orb-two" />
    </div>
    <div className="login-panel"><div className="login-form-wrap"><div className="login-mobile-brand"><div className="brand-mark"><Activity size={20} /></div><strong>DMS<span>Ops</span></strong></div><div className="login-heading"><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your workspace</h2><p>Use your dashboard account credentials to continue.</p></div>
      {(loginError || authError) && <div className="login-error"><AlertCircle size={16} /><span>{loginError || authError}</span></div>}
      <form className="login-form" onSubmit={handleLogin}><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="name@dealership.com" /><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="Enter your password" /><button type="submit" className="button button-primary login-submit" disabled={loggingIn}>{loggingIn ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button></form>
      {isDemoMode && <div className="demo-credentials"><div><span className="demo-credential-label">LOCAL DEMO ACCESS</span><span className="demo-credential-account">Admin: admin@dms.local · Manager: manager@dms.local</span><span className="demo-credential-account">Password: demo1234</span></div><span className="demo-pill">DEMO</span></div>}
      {!isDemoMode && <div className="login-help"><ShieldCheck size={15} /> Dashboard credentials are separate from the Mock DMS portal login. Authentication endpoints must be supplied by the backend.</div>}
    </div><div className="login-panel-footer">© 2026 DMS Report Automation <span>·</span> Secure dashboard access</div></div>
  </div>;

  return <div className="app-shell">
    <Sidebar active={activePage === 'detail' ? 'runs' : activePage} onNavigate={(page) => setActivePage(page)} user={user} />
    <main className="main-shell">
      <Topbar user={user} onLogout={handleLogout} onRunNow={() => setRunModalOpen(true)} canRun={isAdmin} health={health} demoMode={isDemoMode} notifications={notifications} onOpenNotification={(item) => openRun(item.runId)} onViewAllRuns={() => setActivePage('runs')} />
      <div className="content-area">
        {isDemoMode && <div className="demo-warning"><span className="demo-warning-dot" /><strong>Demo environment</strong><span>Sample records are displayed. Run Now simulates a status update in the browser and does not start Playwright.</span></div>}
        {!isDemoMode && !health.ok && <div className="api-warning"><AlertTriangle size={16} /><div><strong>Backend connection unavailable</strong><span>Check that Member 2’s Express API is running at {import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}.</span></div><button type="button" onClick={() => refresh(true)}>Retry</button></div>}
        {refreshError && <div className="api-warning api-warning-subtle"><AlertCircle size={16} /><div><strong>Some dashboard data could not be refreshed</strong><span>{refreshError}</span></div><button type="button" onClick={() => refresh(true)}>Retry</button></div>}
        {activePage === 'overview' && <OverviewPage reports={reports} runs={runs} latestByReport={latestByReport} stats={stats} health={health} loading={loading} onSelectRun={openRun} onViewRuns={() => setActivePage('runs')} onManageReport={openReportSettings} canManage={isAdmin} />}
        {activePage === 'runs' && <RunsPage runs={runs} loading={loading} onSelectRun={openRun} onRefresh={() => refresh(true)} />}
        {activePage === 'reports' && <ReportSettingsPage reports={reports} latestByReport={latestByReport} canManage={isAdmin} onEdit={setEditReport} />}
        {activePage === 'detail' && <RunDetails detail={runDetail} loading={detailLoading} error={detailError} onBack={() => setActivePage('runs')} onSelectFile={openFileMetadata} />}
        <footer className="app-footer"><span>DMS REPORT AUTOMATION <b>·</b> FSD-B06-T03</span><span>Mock DMS environment <b>·</b> Synthetic data only</span></footer>
      </div>
    </main>
    {runModalOpen && <RunNowModal reports={reports.filter((r) => r.enabled)} onClose={() => setRunModalOpen(false)} onSubmit={handleStartRun} submitting={startingRun} />}
    {editReport && isAdmin && <ReportEditModal report={editReport} onClose={() => setEditReport(null)} onSave={handleSaveReport} saving={savingReport} />}
    {(fileMetadata || fileLoading || fileError) && <FileMetadataModal metadata={fileMetadata} loading={fileLoading} error={fileError} onClose={() => { setFileMetadata(null); setFileError(''); }} />}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </div>;
}
