import { Check, CircleAlert, Clock3, LoaderCircle, X } from 'lucide-react';
import { normalizeStatus, statusLabel } from '../utils/format.js';

const iconMap = {
  success: Check,
  partial: CircleAlert,
  failed: X,
  running: LoaderCircle,
  queued: Clock3,
  unknown: Clock3,
};

export default function StatusBadge({ status, compact = false }) {
  const normalized = normalizeStatus(status);
  const Icon = iconMap[normalized] || Clock3;
  return (
    <span className={`status-badge status-${normalized} ${compact ? 'status-compact' : ''}`}>
      <Icon size={compact ? 12 : 14} strokeWidth={2.3} className={normalized === 'running' ? 'spin' : ''} />
      {statusLabel(status)}
    </span>
  );
}
