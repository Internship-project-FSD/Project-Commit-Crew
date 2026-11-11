import { ArrowUpRight, ChevronRight, Clock3 } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, formatDuration, formatNumber } from '../utils/format.js';

export default function RunTable({ runs, onSelect, compact = false, loading = false }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Run ID</th><th>Started</th><th>Trigger</th><th>Status</th><th>Rows loaded</th><th>Duration</th><th aria-label="Open" /></tr></thead>
        <tbody>
          {loading && <tr><td colSpan="7" className="table-empty">Loading run history…</td></tr>}
          {!loading && runs.length === 0 && <tr><td colSpan="7" className="table-empty">No automation runs found.</td></tr>}
          {!loading && runs.map((run) => (
            <tr key={run.id} className="clickable-row" onClick={() => onSelect(run.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect(run.id)}>
              <td><div className="run-id-cell"><span className="run-id-symbol"><Clock3 size={14} /></span><span><strong>{run.id}</strong><small>{run.reportCount ? `${run.reportCount} reports` : run.triggerLabel}</small></span></div></td>
              <td><span className="table-main">{formatDateTime(run.startedAt)}</span><span className="table-sub">{run.endedAt ? `Ended ${formatDateTime(run.endedAt)}` : 'In progress'}</span></td>
              <td><span className={`trigger-tag ${run.trigger === 'manual' ? 'trigger-manual' : ''}`}>{run.triggerLabel}</span></td>
              <td><StatusBadge status={run.status} compact /></td>
              <td><span className="table-main number-cell">{formatNumber(run.rowsLoaded)}</span><span className="table-sub">{formatNumber(run.rowsRejected)} rejected</span></td>
              <td><span className="table-main">{formatDuration(run.startedAt, run.endedAt)}</span></td>
              <td><button className="row-open-button" type="button" onClick={(e) => { e.stopPropagation(); onSelect(run.id); }} aria-label={`View ${run.id}`}><ChevronRight size={17} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact && runs.length > 0 && <div className="table-footnote"><span>Showing the latest {runs.length} runs</span><button type="button" className="text-link" onClick={() => onSelect('__all__')}>View all runs <ArrowUpRight size={13} /></button></div>}
    </div>
  );
}
