import 'dotenv/config';
import app from './app.js';
import { testConnection, pool } from './config/db.js';
import { initializeScheduler } from './services/schedulerService.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const dbOk = await testConnection();
  if (!dbOk) throw new Error('Cannot start automation backend: PostgreSQL connection failed.');
  await initializeScheduler();
  const server = app.listen(PORT, () => console.log(`Automation backend running at http://localhost:${PORT}`));

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
