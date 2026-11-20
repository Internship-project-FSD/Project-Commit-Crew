'use strict';

require('dotenv').config();
const { app, pool } = require('./app');
const { initializeDatabase } = require('./config/database');

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await initializeDatabase();
    const server = app.listen(PORT, () => {
      console.log(`DMS backend running at http://localhost:${PORT}`);
      console.log(`PostgreSQL database: ${process.env.DB_NAME}`);
      console.log(`Frontend origin: ${process.env.FRONTEND_URL || 'http://localhost:5174'}`);
    });

    async function shutdown() {
      console.log('\nShutting down DMS backend...');
      server.close(async () => {
        try { await pool.end(); }
        finally { process.exit(0); }
      });
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Could not start the backend:', error.message);
    await pool.end().catch(() => {});
    process.exitCode = 1;
  }
}

if (require.main === module) startServer();
module.exports = { startServer, app };
