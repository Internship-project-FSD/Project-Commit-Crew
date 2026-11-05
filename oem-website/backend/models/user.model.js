'use strict';

const { pool } = require('../config/database');

async function createUser(username, email, passwordHash) {
  const result = await pool.query(
    `INSERT INTO app_users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, created_at`,
    [username, email, passwordHash]
  );

  return result.rows[0];
}

async function findUserByLogin(login) {
  const result = await pool.query(
    `SELECT id, username, email, password_hash
     FROM app_users
     WHERE LOWER(username) = LOWER($1)
        OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [login]
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, username, email, created_at
     FROM app_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByLogin,
  findUserById
};