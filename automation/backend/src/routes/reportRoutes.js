import { Router } from 'express';
import {
  listReports,
  getReportData,
  updateReport
} from '../controllers/reportController.js';

const router = Router();

router.get('/', listReports);
router.get('/:reportName/data', getReportData);
router.put('/:id', updateReport);

export default router;