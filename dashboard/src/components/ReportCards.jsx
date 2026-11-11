import { ArrowUpRight, Boxes, CarFront, FileCheck2, Wrench } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, formatNumber, normalizeStatus } from '../utils/format.js';

const icons = [CarFront, Wrench, Boxes, FileCheck2];

export default function ReportCards({ reports, latestByReport = {}, onManage, canManage, compact = false }) {
  return (
    <div className={`report-grid ${compact ? 'report-grid-compact' : ''}`}>
      {reports.map((report, index) => {
        const last = latestByReport[report.id] || {};
        const status = last.status || report.lastStatus || 'unknown';
        const Icon = icons[index % icons.length];
        const loaded = last.rowsLoaded ?? report.rowsLoaded ?? 0;
        return (
          <article className="report-card" key={report.id}>
            <div className="report-card-head"><div className={`report-icon report-icon-${index % 4}`}><Icon size={19} /></div><StatusBadge status={status} compact /></div>
            <h3>{report.name}</h3>
            <div className="report-card-meta"><span className="report-meta-label">Rows loaded · latest run</span><strong>{formatNumber(loaded)}</strong></div>
            <div className="report-card-bottom"><span className="report-updated">{last.startedAt || report.lastRunAt ? `Last run ${formatDateTime(last.startedAt || report.lastRunAt)}` : 'No run recorded'}</span>{canManage && <button type="button" onClick={() => onManage(report)} className="report-edit-link">Edit <ArrowUpRight size={13} /></button>}</div>
            {!compact && <div className={`report-card-state state-${normalizeStatus(status)}`} />}
          </article>
        );
      })}
    </div>
  );
}
