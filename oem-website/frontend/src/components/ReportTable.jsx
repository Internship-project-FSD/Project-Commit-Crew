export default function ReportTable({ reportData }) {
  if (!reportData) {
    return (
      <div className="empty-state">
        <div className="empty-icon">▤</div>
        <h3>No report generated</h3>
        <p>Select your filters above and generate a report.</p>
      </div>
    );
  }

  if (reportData.rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">∅</div>
        <h3>No matching records</h3>
        <p>The selected date range or test scenario returned no rows.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table data-testid="report-table">
        <thead>
          <tr>
            {reportData.columns.map((column) => (
              <th key={column}>
                {column.replaceAll('_', ' ')}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {reportData.rows.slice(0, 20).map((row, index) => (
            <tr
              key={`${row[reportData.columns[0]]}-${index}`}
            >
              {reportData.columns.map((column) => (
                <td key={column}>
                  {row[column] === '' ? (
                    <span className="missing-value">Missing</span>
                  ) : (
                    String(row[column] ?? '')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {reportData.rows.length > 20 && (
        <p className="table-footnote">
          Showing the first 20 of {reportData.rows.length} rows.
          Download the CSV to view the complete report.
        </p>
      )}
    </div>
  );
}