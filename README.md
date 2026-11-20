# DMS Report Automation

Team: FSD-B06-T03  
Project: DMS Report Automation  
Stack: React, Express, Playwright, PostgreSQL, Jest

This repository is the original project with targeted fixes to the importer, report execution, scheduler, dashboard authentication and test setup. The original application folders and sample CSV files are retained.

## 1. Requirements

- Node.js 20 or later (Node.js 22 LTS or 24 is recommended for the current dependency versions).
- PostgreSQL 14 or later.
- npm.
- Playwright Chromium for browser automation.

## 2. Database setup

Create a PostgreSQL database named `dms_reports` (or choose another name and use it consistently in each `.env` file). Run the SQL files in this order from the repository root:

1. `db/001_schema.sql`
2. `db/002_seed.sql`
3. `db/003_report_settings.sql`
4. `db/004_rename_report_path.sql`
5. `db/005_seed_report_settings.sql`
6. `db/006_file_metadata.sql`
7. `db/007_fixed_date_range.sql`
8. `db/008_skipped_row_counts.sql`
9. `db/009_run_traceability.sql`
10. `db/010_configuration_driven_reports.sql`

Example from PowerShell (replace the database user if necessary):

```powershell
Get-Content .\db\001_schema.sql | psql -h localhost -U postgres -d dms_reports
Get-Content .\db\002_seed.sql | psql -h localhost -U postgres -d dms_reports
# Repeat for 003 through 010 in order.
```

Create a separate database named `dms_reports_test` for test data. Apply the same schema, seed and migration SQL files to it. Set `TEST_DB_NAME=dms_reports_test` in both backend `.env` files. Database/API Jest suites use this database when explicitly enabled and refuse to run without `TEST_DB_NAME`; do not use a production or shared database.

## 3. Environment files

Copy each example file to `.env` in the same folder and replace every placeholder:

- `automation/backend/.env.example` → `automation/backend/.env`
- `automation/playwright/.env.example` → `automation/playwright/.env`
- `mock-dms/backend/.env.example` → `mock-dms/backend/.env`
- `dashboard/.env.example` → `dashboard/.env`

The `AUTOMATION_SECRET` value must match in `mock-dms/backend/.env` and `automation/playwright/.env`. Use the same PostgreSQL connection details in both backend environment files.

Generate an independent dashboard Admin password hash and Manager password hash from the repository root:

```powershell
node .\scripts\create-dashboard-password-hash.mjs
```

Copy the resulting `scrypt$...` value into the corresponding `DASHBOARD_*_PASSWORD_HASH` entry. Use different passwords for the two roles. Do not commit `.env` files or password values. The source archive supplied for this update contained live `.env` files; they have been removed from this deliverable. Rotate any credentials from the old archive before reusing the environment.

To test API endpoints, the optional `RUN_API_ADMIN_PASSWORD` and `RUN_API_MANAGER_PASSWORD` values are test-only clear-text credentials that must match the configured hashes. Omit these in normal/production use; provide them only in a local test environment and never commit them.

The Mock DMS browser automation account must exist in the Mock DMS users table. Register the account through the Mock DMS signup flow and complete OTP verification, then use that account for `AUTOMATION_USERNAME` / `DMS_USERNAME` and `DMS_PASSWORD`.

## 4. Install dependencies

The test suites import production modules from `automation/backend`. Installing only `Testing/jest` is not enough: Node resolves `csv-parse` and `pg` from the backend package, not from the sibling Jest folder.

For the core and Jest tests, run this once from the repository root:

```powershell
npm run test:setup
```

This installs both the backend runtime dependencies (`csv-parse`, `pg`, etc.) and the Jest test dependencies. You can install them separately when needed:

```powershell
npm run test:setup:core
npm run test:setup:jest
```

For running the complete applications and Playwright, install the remaining application packages too:

```powershell
npm --prefix .\automation\playwright install
npm --prefix .\mock-dms\backend install
npm --prefix .\mock-dms\frontend install
npm --prefix .\dashboard install
```

Install Chromium once for Playwright:

```powershell
npm --prefix .\automation\playwright exec -- playwright install chromium
```

## 5. Start the applications

Open separate PowerShell terminals at the repository root.

Terminal 1, Mock DMS backend:

```powershell
npm --prefix .\mock-dms\backend start
```

Terminal 2, Mock DMS frontend:

```powershell
npm --prefix .\mock-dms\frontend run dev
```

Terminal 3, automation backend:

```powershell
npm --prefix .\automation\backend start
```

Terminal 4, dashboard:

```powershell
npm --prefix .\dashboard run dev
```

Default local URLs:

- Mock DMS: http://localhost:5174
- Mock DMS API: http://localhost:5000
- Dashboard: http://localhost:5173
- Automation API: http://localhost:3000

## 6. Run tests

After running `npm run test:setup`, run the production-path checks:

```powershell
npm run test:core
```

The `pretest:core` dependency check now detects missing backend packages before Node starts the tests and prints the exact setup command. It prevents import-time `ERR_MODULE_NOT_FOUND` errors from looking like assertion failures.

Run Jest unit tests:

```powershell
npm run test:unit
```

Run the default Jest selection. Database/API/E2E suites are explicitly reported as skipped unless enabled:

```powershell
npm run test:jest
```

Run PostgreSQL integration tests (requires the dedicated `TEST_DB_NAME` database and all migrations):

```powershell
npm run test:integration
```

Run API tests (requires the dedicated `TEST_DB_NAME` database, both dashboard test credentials and both backend services configured):

```powershell
npm run test:api
```

Run browser/system tests (requires Mock DMS services and Playwright Chromium):

```powershell
npm run test:e2e
```

Run all checks, including every opt-in integration/API/E2E suite:

```powershell
npm run test:all
```

A skip is not a pass. The test summary distinguishes skipped suites from passed tests. The integration/API/E2E commands deliberately fail when explicitly requested and their prerequisites are unavailable.

## 7. Main changes in this update

- CSV validation checks required headers/fields, valid ISO dates and numeric formats, and retains row-level rejection reasons.
- Typed report imports bulk-insert into staging within a database transaction; rejected rows and file status are saved transactionally.
- File metadata includes the source path, size, download time and separate skipped-row count.
- SHA-256 duplicate detection supports an explicit forced reprocess option while unique-key constraints prevent duplicate final rows.
- Scheduled runs use a single run record per cron batch, support fixed date ranges and process configured reports without a hard-coded four-report map.
- A report-level download failure is recorded and does not stop subsequent report downloads.
- Additional report types use generic JSONB staging/final tables so a new configuration can be stored without creating new tables.
- Dashboard login uses signed HttpOnly sessions with Admin and Manager roles. Managers can view but cannot start runs or change report configuration.
- Jest integration/API/E2E suites no longer quietly return success when prerequisites are missing.

## 8. Known verification boundaries


**MFA/automation security decision to review:** the supplied Mock DMS originally contained an OTP login flow and a separate `/api/auth/automation-login` service endpoint that authenticates a dedicated account using a shared secret and password without completing OTP. Because SRS constraint C2 prohibits bypassing MFA, confirm this design with the mentor/Domain Team before release. If the Mock DMS is considered to require MFA for that account, scheduled automation must stop and log the MFA requirement instead of using the service endpoint.

**SRS technology-version discrepancy to resolve with the mentor:** the SRS/Test Plan specify Node.js 18, Express 4, React 18, `node-cron` 3, `csv-parse` 5 and `dotenv` 16. The existing package manifests in this repository use a newer set (Node 20+, Express 5, React 19, `node-cron` 4, `csv-parse` 7 and `dotenv` 18). I have not silently downgraded those packages because this environment cannot install and verify the matching lockfiles. Before final submission, either obtain approval to update the SRS/Test Plan version baseline or pin the packages to the documented versions and run the complete regression suite.


Unit/core tests use production modules, with database clients injected where a live PostgreSQL instance is not required. Actual PostgreSQL transaction behaviour, live Playwright downloads, cross-browser dashboard usability and Domain Team UAT must still be run and recorded in the local test environment. Complete the Test Case document, JIRA bug report, RTM, Test Summary Report and UAT sign-off before treating the project as an ICTAK release.

### Test dependency setup (Windows / PowerShell)

From the repository root, run `npm run test:setup` once. This installs both the
backend dependencies used by the production-path tests and the Jest dependencies
used by `Testing/jest`.

If the backend dependencies are already installed and only Jest is missing, run
`npm run test:setup:jest`. Running only `npm run test:setup:core` installs backend
dependencies only; it does not install Jest.

Then run `npm run test:core` followed by `npm run test:jest`.

## 9. Fixes from the latest Windows Jest run

The Windows run reported one CSV date-validation failure and two SHA-256 test failures:

- `csvValidator.js` now identifies date columns from the CSV header and mapping independently. This correctly recognizes camel-case names such as `InvoiceDate` even when the report configuration has no `column_mapping` entry.
- The Jest CSV and hash test helpers now create temporary files with UUID-based names. The previous `Date.now()`-only names could collide when multiple files were created within the same millisecond, causing different-content hash tests to read the same overwritten file.
- A core regression test now verifies invalid `InvoiceDate` values without a column mapping.

The updated Node core suite was executed after these changes: **34 passed, 0 failed**. Direct production-module checks also confirmed invalid calendar dates are rejected and different file contents produce different SHA-256 digests. The Jest runner itself has not yet been rerun after these changes in this packaging environment; run `npm run test:jest` locally to confirm the updated Jest suites.
