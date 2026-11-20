'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('Set SESSION_SECRET (32+ characters) in mock-dms/backend/.env.');
}

const app = express();
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(cors({ origin: FRONTEND_URL, credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '100kb' }));

const PgSessionStore = connectPgSimple(session);
app.use(session({
  store: new PgSessionStore({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  name: 'dms.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  console.error('Request error:', error.message);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

module.exports = { app, pool };
