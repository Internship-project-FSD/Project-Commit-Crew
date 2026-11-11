import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function MetricCard({ label, value, note, icon: Icon, tone = 'blue', trend }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon metric-${tone}`}><Icon size={18} /></span></div>
      <div className="metric-value-row"><strong>{value}</strong>{trend && <span className={`metric-trend ${trend.direction}`} >{trend.direction === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{trend.label}</span>}</div>
      <span className="metric-note">{note}</span>
    </div>
  );
}
