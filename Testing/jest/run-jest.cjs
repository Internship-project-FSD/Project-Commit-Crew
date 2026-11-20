'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mode = process.argv[2] || 'all';

const modes = {
  all: ['--runInBand'],
  unit: ['--runInBand', '--testPathPattern=unit'],
  integration: ['--runInBand', '--testPathPattern=integration'],
  api: ['--runInBand', '--testPathPattern=api', '--transformIgnorePatterns=/node_modules/|/automation/backend/src/'],
  e2e: ['--runInBand', '--testPathPattern=e2e'],
  coverage: ['--runInBand', '--coverage'],
};

if (!Object.hasOwn(modes, mode) && mode !== 'full') {
  console.error(`Unknown Jest mode "${mode}". Use: ${[...Object.keys(modes), 'full'].join(', ')}`);
  process.exit(2);
}

let jestBin;

try {
  jestBin = require.resolve('jest/bin/jest', { paths: [__dirname] });
} catch (error) {
  console.error('Jest is not installed in Testing/jest.');
  process.exit(2);
}

function runSuite(suiteMode) {
  const env = { ...process.env };

  delete env.RUN_DATABASE_TESTS;
  delete env.RUN_API_TESTS;
  delete env.RUN_E2E_TESTS;

  if (suiteMode === 'integration') env.RUN_DATABASE_TESTS = 'true';
  if (suiteMode === 'api') env.RUN_API_TESTS = 'true';
  if (suiteMode === 'e2e') env.RUN_E2E_TESTS = 'true';

  const nodeArgs = suiteMode === 'api'
    ? ['--experimental-vm-modules']
    : [];

  console.log(`\n========== RUNNING ${suiteMode.toUpperCase()} TESTS ==========\n`);

  const result = spawnSync(
    process.execPath,
    [...nodeArgs, jestBin, ...modes[suiteMode]],
    {
      cwd: path.resolve(__dirname),
      env,
      stdio: 'inherit',
    }
  );

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}

if (mode === 'full') {
  const suites = ['unit', 'integration', 'api', 'e2e'];
  let failed = false;

  for (const suite of suites) {
    if (runSuite(suite) !== 0) {
      failed = true;
      console.error(`\nFAILED SUITE: ${suite.toUpperCase()}`);
    }
  }

  console.log('\n========== FULL TEST RUN FINISHED ==========');
  process.exit(failed ? 1 : 0);
}

process.exit(runSuite(mode));
