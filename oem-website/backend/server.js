'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const {
  pool,
  initializeDatabase
} = require('./config/database');

const authRoutes = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || 'http://localhost:5173';

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.JWT_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    'Set SESSION_SECRET or JWT_SECRET to a random secret of at least 32 characters in backend/.env.'
  );
}

app.disable('x-powered-by');

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));

// Persist login sessions in PostgreSQL.
const PgSessionStore = connectPgSimple(session);

app.use(session({
  store: new PgSessionStore({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  name: 'dms.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// Health check: confirms that PostgreSQL is reachable.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error.message);

    res.status(503).json({
      status: 'error',
      database: 'disconnected'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint not found.'
  });
});

app.use((error, req, res, next) => {
  console.error('Request error:', error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    message: 'An unexpected server error occurred.'
  });
});

async function startServer() {
  try {
    await initializeDatabase();

    const server = app.listen(PORT, () => {
      console.log(`DMS backend running at http://localhost:${PORT}`);
      console.log(`PostgreSQL database: ${process.env.DB_NAME}`);
      console.log(`Frontend origin: ${FRONTEND_URL}`);
    });

    async function shutdown() {
      console.log('\nShutting down DMS backend...');

      server.close(async () => {
        try {
          await pool.end();
        } finally {
          process.exit(0);
        }
      });
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Could not start the backend:', error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

startServer();