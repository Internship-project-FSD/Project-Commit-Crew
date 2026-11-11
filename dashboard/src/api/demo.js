const now = new Date('2026-11-02T10:25:00+05:30');

const reports = [
  {
    report_id: 'RPT-001', name: 'Vehicle Sales & Purchases', portal_path: '/reports/vehicle-sales',
    download_folder: 'downloads/vehicle_sales', date_strategy: 'yesterday', schedule_cron: '0 6 * * *',
    required_columns: ['InvoiceNo', 'InvoiceDate', 'VIN', 'Amount'], unique_key: ['InvoiceNo'],
    column_mapping: { InvoiceNo: 'invoice_no', InvoiceDate: 'invoice_date', VIN: 'vin', Amount: 'amount' },
    enabled: true, last_status: 'Success', last_run_at: '2026-11-02T06:02:00+05:30', rows_loaded: 186,
  },
  {
    report_id: 'RPT-002', name: 'Service Transactions', portal_path: '/reports/service-transactions',
    download_folder: 'downloads/service_transactions', date_strategy: 'yesterday', schedule_cron: '0 6 * * *',
    required_columns: ['JobCardNo', 'ServiceDate', 'VehicleModel', 'Amount'], unique_key: ['JobCardNo'],
    column_mapping: { JobCardNo: 'job_card_no', ServiceDate: 'service_date', VehicleModel: 'vehicle_model', Amount: 'amount' },
    enabled: true, last_status: 'Partial', last_run_at: '2026-11-02T06:02:00+05:30', rows_loaded: 102,
  },
  {
    report_id: 'RPT-003', name: 'Spare Parts Sales & Purchases', portal_path: '/reports/spare-parts',
    download_folder: 'downloads/spare_parts', date_strategy: 'yesterday', schedule_cron: '0 6 * * *',
    required_columns: ['PartTxnNo', 'TxnDate', 'PartCode', 'Quantity'], unique_key: ['PartTxnNo'],
    column_mapping: { PartTxnNo: 'part_txn_no', TxnDate: 'txn_date', PartCode: 'part_code', Quantity: 'quantity' },
    enabled: true, last_status: 'Success', last_run_at: '2026-11-02T06:02:00+05:30', rows_loaded: 143,
  },
  {
    report_id: 'RPT-004', name: 'Insurance Renewals', portal_path: '/reports/insurance-renewals',
    download_folder: 'downloads/insurance_renewals', date_strategy: 'yesterday', schedule_cron: '0 6 * * *',
    required_columns: ['PolicyNo', 'ExpiryDate', 'VehicleModel', 'Premium'], unique_key: ['PolicyNo'],
    column_mapping: { PolicyNo: 'policy_no', ExpiryDate: 'expiry_date', VehicleModel: 'vehicle_model', Premium: 'premium' },
    enabled: true, last_status: 'Success', last_run_at: '2026-11-02T06:02:00+05:30', rows_loaded: 37,
  },
];

let runRecords = [
  {
    run_id: 'RUN-20261102-0600', started_at: '2026-11-02T06:00:00+05:30', ended_at: '2026-11-02T06:02:18+05:30',
    trigger: 'schedule', status: 'Partial', rows_read: 492, rows_loaded: 468, rows_skipped: 11, rows_rejected: 13,
    reports: [
      { report_id: 'RPT-001', report_name: 'Vehicle Sales & Purchases', status: 'Success', rows_read: 190, rows_loaded: 186, rows_skipped: 4, rows_rejected: 0, downloaded: true, file_id: 'FILE-1001' },
      { report_id: 'RPT-002', report_name: 'Service Transactions', status: 'Partial', rows_read: 112, rows_loaded: 102, rows_skipped: 3, rows_rejected: 7, downloaded: true, file_id: 'FILE-1002', error: '7 rows rejected: required field JobCardNo is missing.' },
      { report_id: 'RPT-003', report_name: 'Spare Parts Sales & Purchases', status: 'Success', rows_read: 148, rows_loaded: 143, rows_skipped: 4, rows_rejected: 1, downloaded: true, file_id: 'FILE-1003' },
      { report_id: 'RPT-004', report_name: 'Insurance Renewals', status: 'Success', rows_read: 42, rows_loaded: 37, rows_skipped: 0, rows_rejected: 5, downloaded: true, file_id: 'FILE-1004' },
    ],
  },
  {
    run_id: 'RUN-20261101-0600', started_at: '2026-11-01T06:00:00+05:30', ended_at: '2026-11-01T06:01:41+05:30',
    trigger: 'schedule', status: 'Success', rows_read: 431, rows_loaded: 419, rows_skipped: 8, rows_rejected: 4,
    reports: reports.map((r, i) => ({ report_id: r.report_id, report_name: r.name, status: 'Success', rows_loaded: [164, 111, 109, 35][i], downloaded: true })),
  },
  {
    run_id: 'RUN-20261031-0600', started_at: '2026-10-31T06:00:00+05:30', ended_at: '2026-10-31T06:00:13+05:30',
    trigger: 'schedule', status: 'Failed', rows_read: 0, rows_loaded: 0, rows_skipped: 0, rows_rejected: 0,
    reports: reports.map((r) => ({ report_id: r.report_id, report_name: r.name, status: 'Failed', downloaded: false, error: 'Run stopped: mock DMS authentication failed.' })),
  },
  {
    run_id: 'RUN-20261030-0935', started_at: '2026-10-30T09:35:00+05:30', ended_at: '2026-10-30T09:37:06+05:30',
    trigger: 'manual', status: 'Success', rows_read: 508, rows_loaded: 497, rows_skipped: 7, rows_rejected: 4,
    reports: reports.map((r, i) => ({ report_id: r.report_id, report_name: r.name, status: 'Success', rows_loaded: [190, 125, 140, 42][i], downloaded: true })),
  },
];

let reportSettings = reports.map((r) => ({ ...r }));
let nextRunNumber = 1;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const demoAdmin = { id: 'demo-admin', name: 'Alex Morgan', email: 'admin@dms.local', role: 'admin' };
const demoManager = { id: 'demo-manager', name: 'Sam Taylor', email: 'manager@dms.local', role: 'manager' };

export const demoApi = {
  async login({ username, email, password }) {
    await pause(450);
    const identity = (username || email || '').trim().toLowerCase();
    if (password !== 'demo1234' || ![demoAdmin.email, demoManager.email].includes(identity)) {
      const error = new Error('Invalid demo login. Check the sample credentials below.');
      error.response = { data: { message: error.message } };
      throw error;
    }
    const user = identity === demoManager.email ? demoManager : demoAdmin;
    sessionStorage.setItem('dms_dashboard_user', JSON.stringify(user));
    return { user };
  },
  async me() {
    const user = JSON.parse(sessionStorage.getItem('dms_dashboard_user') || 'null');
    if (!user) throw new Error('No demo session');
    return { user };
  },
  async logout() { sessionStorage.removeItem('dms_dashboard_user'); return { success: true }; },
  async getHealth() { return { status: 'ok', database: 'connected', service: 'running', checkedAt: now.toISOString() }; },
  async getReports() { return { reports: reportSettings.map((r) => ({ ...r })) }; },
  async updateReport(id, payload) {
    const index = reportSettings.findIndex((r) => String(r.report_id) === String(id));
    if (index < 0) throw new Error('Report configuration not found');
    reportSettings[index] = { ...reportSettings[index], ...payload };
    return { report: { ...reportSettings[index] } };
  },
  async getRuns({ limit = 20, status } = {}) {
    let items = [...runRecords];
    if (status && status !== 'all') items = items.filter((r) => r.status.toLowerCase() === String(status).toLowerCase());
    return { runs: items.slice(0, Number(limit) || 20) };
  },
  async startRun(payload) {
    await pause(300);
    const id = `RUN-DEMO-${String(nextRunNumber++).padStart(3, '0')}`;
    const started = new Date();
    const selected = payload?.reportId ? reportSettings.filter((r) => String(r.report_id) === String(payload.reportId)) : reportSettings.filter((r) => r.enabled);
    const run = {
      run_id: id,
      started_at: started.toISOString(),
      ended_at: null,
      trigger: 'manual',
      status: 'Running',
      rows_read: 0, rows_loaded: 0, rows_skipped: 0, rows_rejected: 0,
      reports: selected.map((r) => ({ report_id: r.report_id, report_name: r.name, status: 'Queued', downloaded: false })),
    };
    runRecords = [run, ...runRecords];
    setTimeout(() => {
      const target = runRecords.find((item) => item.run_id === id);
      if (!target) return;
      target.status = 'Success';
      target.ended_at = new Date().toISOString();
      target.rows_read = selected.length * 118;
      target.rows_loaded = selected.length * 112;
      target.rows_skipped = selected.length * 3;
      target.rows_rejected = selected.length * 3;
      target.reports = target.reports.map((r, i) => ({
        ...r, status: 'Success', downloaded: true,
        rows_read: 118, rows_loaded: 112, rows_skipped: 3, rows_rejected: 3,
        file_id: `FILE-DEMO-${id}-${i + 1}`,
      }));
    }, 2800);
    return { run_id: id, status: 'Running' };
  },
  async getRun(id) {
    await pause(150);
    const run = runRecords.find((item) => item.run_id === id);
    if (!run) throw new Error('Run not found');
    const files = (run.reports || []).filter((r) => r.file_id).map((r, i) => ({
      file_id: r.file_id, report_name: r.report_name, name: `${String(r.report_name).toLowerCase().replace(/[^a-z0-9]+/g, '_')}_2026-11-02.csv`,
      status: r.status === 'Failed' ? 'failed' : 'processed', size_bytes: 18240 + i * 320,
      downloaded_at: run.ended_at || run.started_at, rows_read: r.rows_read || 0, rows_loaded: r.rows_loaded || 0,
      rows_skipped: r.rows_skipped || 0, rows_rejected: r.rows_rejected || 0, error: r.error || null,
    }));
    return {
      run: { ...run }, reports: run.reports || [], files,
      rejected_rows: run.status === 'Partial' ? [
        { row_number: 18, report_name: 'Service Transactions', reason: 'Required field JobCardNo is missing.' },
        { row_number: 24, report_name: 'Service Transactions', reason: 'ServiceDate is not a valid date.' },
      ] : [],
      logs: [
        { log_id: 'LOG-01', timestamp: run.started_at, severity: 'INFO', stage: 'run', message: 'Manual/scheduled automation run started.' },
        { log_id: 'LOG-02', timestamp: run.ended_at || run.started_at, severity: run.status === 'Failed' ? 'ERROR' : 'INFO', stage: 'processing', message: run.status === 'Partial' ? 'Run completed with report-level validation issues.' : `Run status: ${run.status}.` },
      ],
    };
  },
  async getFile(id) { return { file: { file_id: id, name: `${id}.csv`, status: 'processed' } }; },
};
