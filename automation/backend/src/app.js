import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import runRoutes from './routes/runRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYWRIGHT_SCRIPT = path.resolve(__dirname, '../../playwright/run-all-reports.js');
const downloadsDir = path.resolve(__dirname, '../../../downloads');
['incoming', 'processed', 'failed'].forEach((folder) => fs.mkdirSync(path.join(downloadsDir, folder), { recursive: true }));

const app = express();
const dashboardOrigin = process.env.DASHBOARD_ORIGIN || 'http://localhost:5173';
app.disable('x-powered-by');
app.use(cors({ origin: dashboardOrigin, credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  let databaseConnected = false;
  try { await query('SELECT 1'); databaseConnected = true; }
  catch (error) { console.error('Health check database error:', error.message); }
  const playwrightReady = fs.existsSync(PLAYWRIGHT_SCRIPT);
  res.json({
    status: databaseConnected && playwrightReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: { status: databaseConnected ? 'connected' : 'disconnected', connected: databaseConnected },
    automation: { status: playwrightReady ? 'ready' : 'unavailable', ready: playwrightReady },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(errorHandler);

export { app };
export default app;
