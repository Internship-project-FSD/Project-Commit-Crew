import { Router } from 'express';
import { startRun, listRuns, getRun } from '../controllers/runController.js';

const router = Router();

router.post('/start', startRun);
router.get('/', listRuns);
router.get('/:id', getRun);

export default router;
