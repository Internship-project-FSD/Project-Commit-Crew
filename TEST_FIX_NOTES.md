# Test setup and Windows path fix

- Fixed `Testing/core/importService.test.mjs` to convert its module URL with
  `fileURLToPath()` rather than reading `URL.pathname`. The previous approach
  produced invalid paths such as `C:\C:\Users\...` on Windows.
- `npm run test:setup:core` installs the backend dependencies required by the
  production-path tests.
- `npm run test:setup:jest` installs the Jest dependencies under `Testing/jest`.
- `npm run test:setup` installs both dependency groups.
- If `npm run test:jest` reports Jest is missing, run `npm run test:setup:jest`
  from the repository root, then rerun `npm run test:jest`.

The core suite was verified in the packaging workspace with 33 passing tests.
The `processFile` tests exercise the production import service using an injected
fake database client. They do not replace live PostgreSQL integration testing.
