import { Router } from 'express';
import { startRun, listRuns, getRun } from '../controllers/runController.js';
import { requireAuth, requireAdmin } from '../middleware/dashboardAuth.js';

const router = Router();
router.use(requireAuth);
router.post('/start', requireAdmin, startRun);
router.get('/', listRuns);
router.get('/:id', getRun);
export default router;
