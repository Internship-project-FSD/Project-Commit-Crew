export function firstValue(object, keys, fallback = undefined) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) return object[key];
  }
  return fallback;
}

export function normalizeStatus(value) {
  const normalized = String(value || 'unknown').trim().toLowerCase();
  if (['success', 'succeeded', 'completed', 'complete', 'done'].includes(normalized)) return 'success';
  if (['partial', 'partially_successful', 'partially successful'].includes(normalized)) return 'partial';
  if (['failed', 'failure', 'error'].includes(normalized)) return 'failed';
  if (['running', 'processing', 'in_progress', 'in progress'].includes(normalized)) return 'running';
  if (['queued', 'pending', 'scheduled'].includes(normalized)) return 'queued';
  return 'unknown';
}

export function statusLabel(value) {
  const status = normalizeStatus(value);
  return ({ success: 'Success', partial: 'Partial', failed: 'Failed', running: 'Running', queued: 'Queued', unknown: 'Unknown' })[status];
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...options,
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
}

export function formatNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat('en-IN').format(n) : '—';
}

export function formatDuration(start, end) {
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function initials(user) {
  const name = user?.name || user?.email || 'User';
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export function sanitizeText(value) {
  return String(value ?? '')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/(password|passwd|token|access[_ -]?token|refresh[_ -]?token|secret|api[_ -]?key|authorization|session[_ -]?cookie)\s*[:=]\s*([^\s,;]+)/gi, '$1=[redacted]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database connection string redacted]')
    .replace(/(cookie|set-cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]');
}

export function errorMessage(error) {
  const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Something went wrong. Please try again.';
  return sanitizeText(message);
}

export function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
