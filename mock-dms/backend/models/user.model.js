
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

// Remove previous OTPs before creating a new one.
async function deleteUserOtps(userId) {
  await pool.query(
    'DELETE FROM login_otps WHERE user_id = $1',
    [userId]
  );
}

// Save the hashed OTP with a five-minute expiry.
async function createOtp(userId, otpHash) {
  const result = await pool.query(
    `INSERT INTO login_otps (user_id, otp_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
     RETURNING id, expires_at, created_at`,
    [userId, otpHash]
  );

  return result.rows[0];
}

// Find the latest OTP that has not expired or been verified.
async function findActiveOtp(userId) {
  const result = await pool.query(
    `SELECT id, otp_hash, expires_at, attempts, created_at
     FROM login_otps
     WHERE user_id = $1
       AND expires_at > NOW()
       AND verified = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}




// Increase the failed-attempt count.
async function incrementOtpAttempts(otpId) {
  await pool.query(
    `UPDATE login_otps
     SET attempts = attempts + 1
     WHERE id = $1`,
    [otpId]
  );
}

// Delete an OTP after successful verification or when attempts are exhausted.
async function deleteOtp(otpId) {
  await pool.query(
    'DELETE FROM login_otps WHERE id = $1',
    [otpId]
  );
}

module.exports = {
  createUser,
  findUserByLogin,
  findUserById,
  deleteUserOtps,
  createOtp,
  findActiveOtp,
  incrementOtpAttempts,
  deleteOtp
};
