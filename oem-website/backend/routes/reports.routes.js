'use strict';

const express = require('express');

const {
  listReports,
  previewReport,
  downloadReport
} = require('../controllers/reports.controller');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      message: 'Please sign in to continue.'
    });
  }

  next();
}

router.use(requireAuth);

router.get('/', listReports);
router.get('/:reportId', previewReport);
router.get('/:reportId/download', downloadReport);

module.exports = router;