import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { testConnection,query } from './config/db.js';
import runRoutes from './routes/runRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import { initializeScheduler } from './services/schedulerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYWRIGHT_SCRIPT = path.resolve(
  __dirname,
  '..',
  '..',
  'playwright',
  'run-all-reports.js'
);
const downloadsDir = path.resolve(__dirname, '..', '..', '..', 'downloads');

['incoming', 'processed', 'failed'].forEach(dir => {
  const fullPath = path.join(downloadsDir, dir);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', async (req, res) => {
  let databaseConnected = false;
  // Check whether PostgreSQL is responding
  try {
    await query('SELECT 1');
    databaseConnected = true;
  } catch (err) {
    console.error('Health check database error:', err.message);
  }
  // Check whether the Playwright automation script exists
  const playwrightReady = fs.existsSync(PLAYWRIGHT_SCRIPT);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: databaseConnected ? 'connected' : 'disconnected',
      connected: databaseConnected
    },
    automation: {
      status: playwrightReady ? 'ready' : 'unavailable',
      ready: playwrightReady
    }
  });
});

app.use('/api/runs', runRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use(errorHandler);

async function start() {
  const dbOk = await testConnection();

  if (!dbOk) {
    console.error('Cannot start - database connection failed');
    process.exit(1);
  }

  // Register scheduled jobs after connecting to PostgreSQL
  await initializeScheduler();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();

export default app;
