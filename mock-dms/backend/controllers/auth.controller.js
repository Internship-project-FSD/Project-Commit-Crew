'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = require('../models/user.model');
const { sendOtpEmail } = require('../services/email.service');

const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN = 60 * 1000;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email
  };
}

// Create the final authenticated session.
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

// Create a temporary session while waiting for OTP verification.
function createPendingOtpSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);

      req.session.pendingOtpUserId = userId;

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

// Generate and email a new OTP.
async function generateAndSendOtp(user) {
  await User.deleteUserOtps(user.id);

  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = await bcrypt.hash(otp, 10);

  await User.createOtp(user.id, otpHash);

  try {
    await sendOtpEmail(user.email, otp);
  } catch (error) {
    await User.deleteUserOtps(user.id);
    throw error;
  }
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

// Step 1: Validate password and send OTP.
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

    await generateAndSendOtp(user);
    await createPendingOtpSession(req, user.id);

    return res.json({
      otpRequired: true,
      message: 'OTP sent to your registered email address.'
    });
  } catch (error) {
    console.error('Login OTP error:', error.message);
    next(error);
  }
}

// Step 2: Verify OTP and create authenticated session.
async function verifyOtp(req, res, next) {
  try {
    const { otp } = req.body || {};
    const userId = req.session?.pendingOtpUserId;

    if (!userId) {
      return res.status(401).json({
        message: 'Please sign in again.'
      });
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'Enter a valid 6-digit OTP.'
      });
    }

    const activeOtp = await User.findActiveOtp(userId);

    if (!activeOtp) {
      await User.deleteUserOtps(userId);
      await destroySession(req);
      clearSessionCookie(res);

      return res.status(401).json({
        message: 'OTP expired. Please sign in again.'
      });
    }

    const otpMatches = await bcrypt.compare(
      otp,
      activeOtp.otp_hash
    );

    if (!otpMatches) {
      await User.incrementOtpAttempts(activeOtp.id);

      const attemptsUsed = activeOtp.attempts + 1;

      if (attemptsUsed >= MAX_OTP_ATTEMPTS) {
        await User.deleteOtp(activeOtp.id);
        await destroySession(req);
        clearSessionCookie(res);

        return res.status(401).json({
          message: 'Maximum OTP attempts reached. Please sign in again.'
        });
      }

      return res.status(401).json({
        message: `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attemptsUsed} attempts remaining.`
      });
    }

    await User.deleteOtp(activeOtp.id);

    const user = await User.findUserById(userId);

    if (!user) {
      await destroySession(req);
      clearSessionCookie(res);

      return res.status(401).json({
        message: 'User account not found. Please sign in again.'
      });
    }

    await createSession(req, user);

    return res.json({
      message: 'OTP verified. Signed in successfully.',
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

// Resend OTP with a 60-second cooldown.
async function resendOtp(req, res, next) {
  try {
    const userId = req.session?.pendingOtpUserId;

    if (!userId) {
      return res.status(401).json({
        message: 'Please sign in again.'
      });
    }

    const activeOtp = await User.findActiveOtp(userId);

    if (activeOtp) {
      const createdAt = new Date(activeOtp.created_at).getTime();
      const elapsed = Date.now() - createdAt;

      if (elapsed < OTP_RESEND_COOLDOWN) {
        const remainingSeconds = Math.ceil(
          (OTP_RESEND_COOLDOWN - elapsed) / 1000
        );

        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`
        });
      }
    }

    const user = await User.findUserById(userId);

    if (!user) {
      await destroySession(req);
      clearSessionCookie(res);

      return res.status(401).json({
        message: 'User account not found. Please sign in again.'
      });
    }

    await generateAndSendOtp(user);

    return res.json({
      otpRequired: true,
      message: 'A new OTP has been sent to your registered email address.'
    });
  } catch (error) {
    console.error('OTP resend error:', error.message);
    next(error);
  }
}
// Dedicated login for scheduled Playwright automation.
async function automationLogin(req, res, next) {
  try {
    const configuredSecret = process.env.AUTOMATION_SECRET;
    const configuredUsername = process.env.AUTOMATION_USERNAME;

    const providedSecret = req.get('x-automation-secret') || '';

    if (!configuredSecret || !configuredUsername) {
      return res.status(503).json({
        message: 'Automation authentication is not configured.'
      });
    }

    // Compare secrets safely.
    const expected = Buffer.from(configuredSecret);
    const provided = Buffer.from(providedSecret);

    const secretMatches =
      expected.length === provided.length &&
      crypto.timingSafeEqual(expected, provided);

    if (!secretMatches) {
      return res.status(401).json({
        message: 'Unauthorized automation request.'
      });
    }

    const { username, password } = req.body || {};

    // Only the dedicated automation account is permitted.
    if (
      username !== configuredUsername ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(401).json({
        message: 'Invalid automation credentials.'
      });
    }

    const user = await User.findUserByLogin(username);

    const passwordMatches = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid automation credentials.'
      });
    }

    // Create a regular authenticated session.
    await createSession(req, user);

    return res.json({
      message: 'Automation login successful.',
      user: publicUser(user)
    });

  } catch (error) {
    console.error('Automation login error:', error.message);
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
  verifyOtp,
  resendOtp,
  automationLogin,
  currentUser,
  logout
};
