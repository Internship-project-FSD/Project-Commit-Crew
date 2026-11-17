import fs from 'node:fs';
import { query } from './src/config/db.js';

const sql = fs.readFileSync('../../db/003_report_settings.sql', 'utf8');

await query(sql);

console.log('Migration 003 applied successfully.');
process.exit(0);
