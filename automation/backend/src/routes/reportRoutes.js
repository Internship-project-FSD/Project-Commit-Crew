import { Router } from 'express';
import { listReports, getReportData } from '../controllers/reportController.js';

const router = Router();

router.get('/', listReports);
router.get('/:reportName/data', getReportData);

export default router;
