'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email
  };
}

function createSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);

      req.session.userId = user.id;
      req.session.username = user.username;

      req.session.save((saveError) => {
        if (saveError) return reject(saveError);
        resolve();
      });
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();

    req.session.destroy((error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

function clearSessionCookie(res) {
  res.clearCookie('dms.sid', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
}

async function signup(req, res, next) {
  try {
    const { username, email, password } = req.body || {};

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Username, email and password are required.'
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(cleanUsername)) {
      return res.status(400).json({
        message:
          'Username must be 3–40 characters and contain only letters, numbers, dots, underscores or hyphens.'
      });
    }

    if (
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      return res.status(400).json({
        message: 'Enter a valid email address.'
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        message: 'Password must be between 8 and 128 characters.'
      });
    }

    // Only the hash is stored in PostgreSQL.
    const passwordHash = await bcrypt.hash(password, 12);

    let user;

    try {
      user = await User.createUser(
        cleanUsername,
        cleanEmail,
        passwordHash
      );
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          message: 'That username or email is already registered.'
        });
      }

      throw error;
    }

    await createSession(req, user);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const body = req.body || {};

    const loginValue =
      typeof body.login === 'string'
        ? body.login
        : body.username;

    const { password } = body;

    if (
      typeof loginValue !== 'string' ||
      typeof password !== 'string' ||
      !loginValue.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Username/email and password are required.'
      });
    }

    const user = await User.findUserByLogin(loginValue.trim());

    const passwordMatches = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid username/email or password.'
      });
    }

    await createSession(req, user);

    return res.json({
      message: 'Signed in successfully.',
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function currentUser(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        message: 'Please sign in.'
      });
    }

    const user = await User.findUserById(req.session.userId);

    if (!user) {
      await destroySession(req);
      clearSessionCookie(res);

      return res.status(401).json({
        message: 'Please sign in again.'
      });
    }

    return res.json({
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await destroySession(req);
    clearSessionCookie(res);

    return res.json({
      message: 'Signed out successfully.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  currentUser,
  logout
};