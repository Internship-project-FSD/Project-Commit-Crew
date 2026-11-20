/** Execute every selected report independently. A failure in one report must not
 * stop the remaining reports (SRS FR-10, BR-11 and Test Plan TC-10).
 */
async function processReportsIndividually(reports, processReport) {
  const results = [];
  for (const report of reports) {
    try {
      const value = await processReport(report);
      results.push({ reportId: report.id, reportName: report.name, status: 'success', value });
    } catch (error) {
      results.push({ reportId: report.id, reportName: report.name, status: 'failed', error: error.message });
    }
  }
  const successCount = results.filter((item) => item.status === 'success').length;
  const failedCount = results.length - successCount;
  return {
    status: failedCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial',
    totalReports: results.length,
    successCount,
    failedCount,
    results
  };
}


async function logAutomationFailures(runId, summary, logger) {
  const failures = (summary?.results || []).filter((item) => item.status === 'failed');
  for (const failure of failures) {
    const reportLabel = failure.reportName || failure.reportId || 'Unknown report';
    await logger.error(runId, `Download failed for ${reportLabel}: ${failure.error || 'Unknown error'}`, {
      reportId: failure.reportId || null,
      reportName: failure.reportName || null
    });
  }
  return failures.length;
}

function extractAutomationSummary(stdout = '') {
  const line = String(stdout).split(/\r?\n/).find((item) => item.startsWith('DMS_AUTOMATION_RESULT='));
  if (!line) return null;
  try { return JSON.parse(line.slice('DMS_AUTOMATION_RESULT='.length)); }
  catch { return null; }
}

export { processReportsIndividually, logAutomationFailures, extractAutomationSummary };
