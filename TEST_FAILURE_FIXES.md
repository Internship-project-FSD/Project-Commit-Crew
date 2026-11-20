# Latest Jest failure fixes

## Failures in the Windows run

The supplied Jest output contained three failures:

1. `unit/csvValidator.test.js`: an impossible date such as `2024-02-30` was accepted when the report config did not provide `column_mapping`.
2. `unit/hashService.test.js`: two different-content tests received equal hashes.

## Root causes and changes

- `automation/backend/src/services/csvValidator.js`: `inferColumnType()` previously concatenated the CSV header with an undefined database mapping. For `InvoiceDate`, the resulting string ended in `undefined`, so the date suffix was not detected. Type inference now checks the CSV and DB column names independently and recognizes camel-case/Pascal-case date suffixes.
- `Testing/jest/unit/hashService.test.js`: `writeTempFile()` used only `Date.now()` in the temporary filename. Two writes in the same millisecond could target the same path, so the second file overwrote the first. Temporary filenames now include `process.pid` and `crypto.randomUUID()`.
- `Testing/jest/unit/csvValidator.test.js`: the same UUID-based temporary-name approach is used to avoid collisions in the CSV tests.
- `Testing/core/csvValidator.test.mjs`: added a regression test for an invalid camel-case `InvoiceDate` header when no column mapping exists.

## Verification

Executed in the packaging environment after the changes:

- Node core suite: 34 passed, 0 failed.
- Direct production-module check: invalid `InvoiceDate` rejected.
- Direct production-module check: distinct file contents produced distinct SHA-256 hashes.
- JavaScript syntax check: passed.

The Jest runner itself was not re-executed in this packaging environment because its platform-specific optional resolver binary could not be installed here. The prior Windows Jest run showed 101 passing, 3 failing and 95 skipped before these fixes. Run `npm run test:jest` in the updated project to verify the corrected Jest tests. Environment-dependent integration/API/E2E tests remain skipped unless their prerequisites are explicitly enabled.
