export default function ReportFilters({
  startDate,
  endDate,
  scenario,
  onStartDateChange,
  onEndDateChange,
  onScenarioChange,
  onSubmit,
  busy
}) {
  return (
    <form className="filters" onSubmit={onSubmit}>
      <div className="filter-field">
        <label htmlFor="start-date">Start date</label>

        <input
          id="start-date"
          data-testid="start-date"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          required
        />
      </div>

      <div className="filter-field">
        <label htmlFor="end-date">End date</label>

        <input
          id="end-date"
          data-testid="end-date"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          required
        />
      </div>

      <div className="filter-field">
        <label htmlFor="scenario">Test scenario</label>

        <select
          id="scenario"
          data-testid="scenario"
          value={scenario}
          onChange={(event) => onScenarioChange(event.target.value)}
        >
          <option value="normal">Normal data</option>
          <option value="missing">Missing values</option>
          <option value="duplicates">Duplicate rows</option>
          <option value="empty">Empty results</option>
          <option value="bad-columns">Incorrect columns</option>
        </select>
      </div>

      <button
        type="submit"
        className="primary-button filter-button"
        data-testid="generate-report"
        disabled={busy}
      >
        {busy ? 'Working...' : 'Generate report'}
      </button>
    </form>
  );
}