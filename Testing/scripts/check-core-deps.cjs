#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');

const backendPackage = path.resolve(__dirname, '../../automation/backend/package.json');
const backendRequire = createRequire(backendPackage);
const dependencies = [
  { packageName: 'csv-parse/sync', installName: 'csv-parse' },
  { packageName: 'pg', installName: 'pg' },
];
const missing = dependencies.filter(({ packageName }) => {
  try {
    backendRequire.resolve(packageName);
    return false;
  } catch {
    return true;
  }
});

if (missing.length) {
  console.error('\nCore test dependencies are missing from automation/backend:');
  for (const item of missing) console.error(`  - ${item.installName}`);
  console.error('\nRun this once from the repository root:');
  console.error('  npm run test:setup:core');
  console.error('\nThen rerun: npm run test:core\n');
  process.exit(1);
}

console.log('Core test dependencies found in automation/backend.');
