import { CalendarDays, ChevronDown, Play, X } from 'lucide-react';
import { useState } from 'react';

function yesterdayValue() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function RunNowModal({ reports, onClose, onSubmit, submitting }) {
  const [reportId, setReportId] = useState('all');
  const [startDate, setStartDate] = useState(yesterdayValue);
  const [endDate, setEndDate] = useState(yesterdayValue);
  const [rangeError, setRangeError] = useState('');

  function submit(event) {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      setRangeError('The start date must be on or before the end date.');
      return;
    }
    setRangeError('');
    onSubmit({ reportId: reportId === 'all' ? undefined : reportId, startDate, endDate });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}>
      <section className="modal run-modal" role="dialog" aria-modal="true" aria-labelledby="run-modal-title">
        <div className="modal-head"><div><div className="modal-icon purple"><Play size={18} fill="currentColor" /></div><div><h2 id="run-modal-title">Start automation run</h2><p>Choose the reports and date range for this run.</p></div></div><button className="icon-button" type="button" onClick={onClose} disabled={submitting} aria-label="Close"><X size={18} /></button></div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="run-report">Reports to process</label>
          <div className="select-wrap"><select id="run-report" value={reportId} onChange={(e) => setReportId(e.target.value)}><option value="all">All enabled reports (recommended)</option>{reports.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><ChevronDown size={16} /></div>
          <div className="form-grid two-col">
            <div><label className="field-label" htmlFor="run-start">Start date</label><div className="date-input-wrap"><CalendarDays size={15} /><input id="run-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div></div>
            <div><label className="field-label" htmlFor="run-end">End date</label><div className="date-input-wrap"><CalendarDays size={15} /><input id="run-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div></div>
          </div>
          {rangeError && <div className="inline-error">{rangeError}</div>}
          <div className="modal-info"><span className="info-dot">i</span><p>The backend will coordinate DMS login, CSV downloads, validation and PostgreSQL imports. This dashboard does not run Playwright directly.</p></div>
          <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button><button className="button button-primary" type="submit" disabled={submitting}><Play size={15} fill="currentColor" />{submitting ? 'Starting…' : 'Start run'}</button></div>
        </form>
      </section>
    </div>
  );
}
