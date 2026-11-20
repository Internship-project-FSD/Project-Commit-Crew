import { Router } from 'express';
import { listReports, getReportData, createReport, updateReport } from '../controllers/reportController.js';
import { requireAuth, requireAdmin } from '../middleware/dashboardAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/', listReports);
router.get('/:reportName/data', getReportData);
router.post('/', requireAdmin, createReport);
router.put('/:id', requireAdmin, updateReport);
export default router;
