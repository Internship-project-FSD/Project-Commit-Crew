# DMS Main Automation Dashboard

React 18 + Vite dashboard for the DMS Report Automation project (FSD-B06-T03). It provides a dashboard login, run trigger, run history, report configuration, report-level outcomes, file metadata, rejected-row details and processing logs.

The dashboard communicates with the Express backend using Axios. It does **not** connect to PostgreSQL and does **not** run Playwright in the browser.

## 1. Requirements

- Node.js 18 or later
- npm
- Member 2's Express API running locally (for live integration)

## 2. Run locally

```bash
cd dms-main-dashboard
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

For a production build:

```bash
npm run build
npm run preview
```

## 3. Demo mode

To preview the interface before the backend is ready, set this in `.env`:

```env
VITE_DEMO_MODE=true
```

Demo credentials:

- Admin: `admin@dms.local`
- Manager: `manager@dms.local`
- Password: `demo1234`

Demo mode uses bundled sample records and simulates a successful run status in browser memory. It does not contact the Express backend, database or Playwright. Switch `VITE_DEMO_MODE=false` for real API integration.

## 4. API integration

Set the backend URL in `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_DEMO_MODE=false
```

The documented routes from `D03_System_Design` are used as follows:

| Dashboard action | HTTP method | Endpoint |
|---|---|---|
| Read report configurations | GET | `/api/reports` |
| Update report configuration | PUT | `/api/reports/:id` |
| Trigger a manual run | POST | `/api/runs` |
| Read run history | GET | `/api/runs?limit=50` |
| Read one run and related processing results | GET | `/api/runs/:id` |
| Read downloaded file metadata | GET | `/api/files/:id` |
| Check backend/database health | GET | `/api/health` |

### Request assumptions to confirm with Member 2

D03 describes the manual-run request as an optional report ID and date range, but does not give the exact JSON field names. This dashboard currently sends:

```json
{
  "reportId": "RPT-001",
  "dateRange": {
    "startDate": "2026-11-01",
    "endDate": "2026-11-01"
  }
}
```

When the user selects all enabled reports, `reportId` is omitted. Confirm or change this one request mapping in `src/App.jsx` (`handleStartRun`) to match Member 2's implementation.

Report updates currently send the system-design field names:

```json
{
  "download_folder": "downloads/vehicle_sales",
  "date_strategy": "yesterday",
  "schedule_cron": "0 6 * * *",
  "required_columns": ["InvoiceNo", "InvoiceDate", "VIN", "Amount"],
  "unique_key": ["InvoiceNo"],
  "column_mapping": {
    "InvoiceNo": "invoice_no",
    "InvoiceDate": "invoice_date",
    "VIN": "vin",
    "Amount": "amount"
  },
  "is_enabled": true
}
```

The payload uses `is_enabled` from the system-design data model. Confirm that Member 2 maps this field consistently in the API.

The adapter accepts common response wrappers such as `{ reports: [] }`, `{ runs: [] }`, `{ data: { reports: [] } }`, and camelCase/snake_case property names. The normalizers are in `src/App.jsx`.

## 5. Dashboard authentication: coordination required

The system design identifies two dashboard roles:

- **Dealership IT Admin:** can manually start runs and update report configuration.
- **Dealership Manager:** read-only access to run history, report status and error summaries.

D03 explicitly states that a full identity-management system and authentication endpoints are not defined. Therefore the frontend uses configurable placeholders for the authentication endpoints. Confirm these with Member 2 before live integration:

```env
VITE_AUTH_LOGIN_PATH=/api/auth/login
VITE_AUTH_ME_PATH=/api/auth/me
VITE_AUTH_LOGOUT_PATH=/api/auth/logout
```

Expected login response shape (proposed; confirm with Member 2):

```json
{
  "user": {
    "id": "user-123",
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "role": "admin"
  },
  "token": "optional-bearer-token"
}
```

The implementation supports either an optional bearer token or an HTTP-only cookie (`withCredentials: true`). For production-like use, prefer an HTTP-only, Secure, SameSite cookie. The backend must enforce Admin/Manager permissions; hiding buttons in React is only a user-interface control, not authorization.

Dashboard login is separate from the Mock DMS account used by Playwright. Do not reuse or return the Mock DMS credentials to the dashboard.

## 6. Response fields the dashboard reads

The documented endpoints do not include complete JSON schemas. Please agree the following data with Members 2 and 3:

- **Report configuration:** `report_id`, `name`, `portal_path`, `download_folder`, `date_strategy`, `schedule_cron`, `required_columns`, `unique_key`, `column_mapping`, `is_enabled` (or the API field name confirmed by Member 2).
- **Run list:** `run_id`, `started_at`, `ended_at`, `trigger` (`manual` or `schedule`), `status` (`Success`, `Partial`, `Failed`, plus in-progress states), `rows_read`, `rows_loaded`, `rows_skipped`, `rows_rejected`.
- **Run detail:** `run`, `reports`, `files`, `rejected_rows`, `logs`. Each report result should include its report identifier/name, status, row counts and a safe error message. Each log should include timestamp, severity, run/file ID where applicable, processing stage and message.
- **Health:** `status` and, where available, database connection state.

The dashboard displays report-level errors and rejected-row reasons but does not display passwords, session cookies, database connection strings or other secrets. Backend error messages must be sanitized before returning them to the browser.

## 7. Project structure

```text
src/
  api/
    client.js          Axios client, endpoint map and demo/live switch
    demo.js            Local sample data for UI preview only
  auth/
    AuthContext.jsx    Dashboard authentication and role state
  components/
    MetricCard.jsx
    ReportCards.jsx
    RunDetails.jsx
    RunNowModal.jsx
    RunTable.jsx
    Sidebar.jsx
    StatusBadge.jsx
    Topbar.jsx
  utils/
    format.js
  App.jsx
  main.jsx
  styles.css
```

## 8. Ownership boundaries

- React calls Express REST APIs only.
- Express owns automation orchestration and Playwright execution.
- Backend services own PostgreSQL reads/writes.
- The dashboard only renders the run/report/file/log data that the API returns.
- Admin/Manager authorization must be enforced on the backend.

## 9. Member integration checklist

- [ ] Member 2 confirms login, current-user and logout endpoint paths and response shape.
- [ ] Member 2 confirms cookie or bearer-token authentication and CORS settings.
- [ ] Member 2 confirms the `POST /api/runs` JSON body, including date-range keys and all-reports behavior.
- [ ] Member 2 confirms configuration update keys and allowed `date_strategy` values.
- [ ] Members 2 and 3 agree run status values and how report-level status is represented.
- [ ] Member 2 includes files, rejected rows and logs in `GET /api/runs/:id` (or provides documented routes if separate).
- [ ] Member 2 enforces the Admin/Manager access matrix on protected endpoints.
- [ ] Backend sanitizes error responses and never exposes secrets.
- [ ] Team verifies the dashboard against successful, partial, failed, empty-file, wrong-column, missing-value and timeout test scenarios.

## 10. Visual system refresh

The dashboard now uses the requested dealership palette:

- Sage: `#A5A79B`
- Sand: `#E8D2B5`
- Racing burgundy: `#590907`

The interface combines a deep burgundy navigation rail, warm neutral work surfaces, sage details and sand highlights. Manrope is used for display headings and Inter for interface text. The overview includes a restrained automotive-inspired control-center banner with a custom vector car illustration, gauge treatment and subtle movement. Cards have light depth, perspective hover effects and soft entrance transitions. Motion is reduced automatically when the user's operating system requests reduced motion.

The visual changes do not alter API routes, request payloads, authentication logic, report processing or access permissions.

### Scroll-edge behavior

The dashboard disables vertical overscroll bounce and root scroll chaining with `overscroll-behavior-y: none` on `html` and `body`. Normal vertical scrolling is unchanged.
