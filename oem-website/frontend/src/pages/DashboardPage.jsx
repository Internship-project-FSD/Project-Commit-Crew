import { useEffect, useMemo, useState } from 'react';

import { apiRequest, downloadCsv } from '../services/api';
import ReportFilters from '../components/ReportFilters';
import ReportTable from '../components/ReportTable';

const DEFAULT_START_DATE = '2026-01-01';
const DEFAULT_END_DATE = '2026-04-30';

export default function DashboardPage({ user, onLogout }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState('');

  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [scenario, setScenario] = useState('normal');

  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const activeReport = useMemo(
    () => reports.find((report) => report.id === selectedReport),
    [reports, selectedReport]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        const data = await apiRequest('/reports');

        if (cancelled) return;

        setReports(data);

        if (data.length > 0) {
          setSelectedReport(data[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setError('');
    setMessage('');
    setBusy(true);

    try {
      await apiRequest('/auth/logout', {
        method: 'POST'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      onLogout();
    }
  }

  function selectReport(reportId) {
    setSelectedReport(reportId);
    setReportData(null);
    setMessage('');
    setError('');
  }

  async function generateReport(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setReportData(null);

    if (!selectedReport) {
      setError('Select a report first.');
      return;
    }

    if (!startDate || !endDate || startDate > endDate) {
      setError('Choose a valid date range.');
      return;
    }

    setBusy(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        scenario
      });

      const data = await apiRequest(
        `/reports/${selectedReport}?${params.toString()}`
      );

      setReportData(data);
      setMessage(`Report generated: ${data.count} rows found.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setError('');
    setMessage('');

    if (!reportData) {
      setError('Generate the report before downloading it.');
      return;
    }

    setBusy(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        scenario
      });

      await downloadCsv(
        `/reports/${selectedReport}/download?${params.toString()}`,
        `${selectedReport}.csv`
      );

      setMessage('CSV downloaded successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark small">D</div>

          <div>
            <strong>Dealer Management System</strong>
            <span>Reporting Portal</span>
          </div>
        </div>

        <div className="user-controls">
          <span className="signed-in">
            Signed in as <strong>{user.username}</strong>
          </span>

          <button
            className="secondary-button"
            data-testid="logout-button"
            type="button"
            onClick={handleLogout}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="sidebar">
          <p className="sidebar-heading">REPORTS</p>

          {reports.map((report) => (
            <button
              type="button"
              key={report.id}
              data-testid={`report-link-${report.id}`}
              className={`report-nav-item ${
                selectedReport === report.id ? 'active' : ''
              }`}
              onClick={() => selectReport(report.id)}
            >
              <span className="nav-icon">▤</span>
              <span>{report.name}</span>
            </button>
          ))}
        </aside>

        <section className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">DEALERSHIP OPERATIONS</p>
              <h1>Reports</h1>
              <p className="subtitle">
                Generate, inspect, and download synthetic dealership reports.
              </p>
            </div>

            <span className="status-pill">Signed-in session</span>
          </div>

          {error && (
            <div
              className="alert error"
              role="alert"
              data-testid="status-message"
            >
              {error}
            </div>
          )}

          {message && !error && (
            <div
              className="alert success"
              role="status"
              data-testid="status-message"
            >
              {message}
            </div>
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{activeReport?.name || 'Select a report'}</h2>
                <p>Choose the date range and test scenario.</p>
              </div>
            </div>

            <ReportFilters
              startDate={startDate}
              endDate={endDate}
              scenario={scenario}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onScenarioChange={setScenario}
              onSubmit={generateReport}
              busy={busy}
            />
          </section>

          <section className="panel results-panel">
            <div className="panel-heading results-heading">
              <div>
                <h2>Report preview</h2>
                <p>
                  {reportData
                    ? `${reportData.count} records returned`
                    : 'Generate a report to view its data.'}
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                data-testid="download-csv"
                onClick={handleDownload}
                disabled={busy || !reportData}
              >
                Download CSV
              </button>
            </div>

            <ReportTable reportData={reportData} />
          </section>

          <footer className="page-footer">
            DMS Report Automation · Synthetic data for testing only
          </footer>
        </section>
      </div>
    </main>
  );
}