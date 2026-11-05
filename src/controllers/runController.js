import { getRuns, getRunById } from '../services/runService.js';
import { runFullImport } from '../services/importService.js';

async function startRun(req, res, next) {
  try {
    const result = await runFullImport('manual');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listRuns(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const runs = await getRuns(limit, offset);
    res.json(runs);
  } catch (err) {
    next(err);
  }
}

async function getRun(req, res, next) {
  try {
    const run = await getRunById(parseInt(req.params.id));
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    next(err);
  }
}

export { startRun, listRuns, getRun };
