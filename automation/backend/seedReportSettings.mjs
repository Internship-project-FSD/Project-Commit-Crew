import fs from 'node:fs';
import { query } from './src/config/db.js';

const sql = fs.readFileSync('../../db/005_seed_report_settings.sql', 'utf8');

const result = await query(sql);

console.log('Initial report settings populated successfully.');
process.exit(0);
