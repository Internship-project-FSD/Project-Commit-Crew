const TIMEZONE = 'Asia/Kolkata';

function dateInTimezone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getDateRange(dateStrategy = 'yesterday', fixedStartDate = null, fixedEndDate = null, now = new Date()) {
  if (dateStrategy === 'fixed') {
    if (!isValidDate(fixedStartDate) || !isValidDate(fixedEndDate) || fixedStartDate > fixedEndDate) {
      throw new Error('Fixed date strategy requires valid fixed_start_date and fixed_end_date values.');
    }
    return { startDate: fixedStartDate, endDate: fixedEndDate };
  }

  const endDate = new Date(`${dateInTimezone(now)}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const end = endDate.toISOString().slice(0, 10);
  const days = ({ yesterday: 1, last_7_days: 7, last_30_days: 30 })[dateStrategy];
  if (!days) throw new Error(`Unsupported date strategy: ${dateStrategy}`);
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

export { TIMEZONE, dateInTimezone, isValidDate, getDateRange };
