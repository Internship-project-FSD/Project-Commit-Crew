'use strict';

const express = require('express');

const {
  signup,
  login,
  currentUser,
  logout
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', currentUser);
router.post('/logout', logout);

module.exports = router;