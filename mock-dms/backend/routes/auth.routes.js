'use strict';

const express = require('express');
const {
  signup,
  login,
  verifyOtp,
  resendOtp,
  automationLogin,
  currentUser,
  logout
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/automation-login', automationLogin);
router.get('/me', currentUser);
router.post('/logout', logout);

module.exports = router;