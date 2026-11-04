'use strict';

const { Pool } = require('pg');

const requiredSettings = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

const missingSettings = requiredSettings.filter(
  (setting) => !process.env[setting]
);

if (missingSettings.length > 0) {
  throw new Error(
    `Missing PostgreSQL settings in .env: ${missingSettings.join(', ')}`
  );
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function initializeDatabase() {
  await pool.query('SELECT 1');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(40) NOT NULL,
      email VARCHAR(254) NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_unique
    ON app_users (LOWER(username))
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique
    ON app_users (LOWER(email))
  `);

  console.log('PostgreSQL connected. User table is ready.');
}

module.exports = {
  pool,
  initializeDatabase
};