import fs from 'node:fs';
import { query } from './src/config/db.js';

const sql = fs.readFileSync('../../db/004_rename_report_path.sql', 'utf8');

await query(sql);

console.log('Migration 004 applied successfully.');
process.exit(0);
