import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { uploadFile } from '../controllers/uploadController.js';
import { requireAdmin } from '../middleware/dashboardAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INCOMING_DIR = path.resolve(__dirname, '../../../../downloads/incoming');
fs.mkdirSync(INCOMING_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: INCOMING_DIR,
  filename: (req, file, callback) => {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    callback(null, `${Date.now()}_${safeName}`);
  },
});
const fileFilter = (req, file, callback) => {
  if (!file.originalname.toLowerCase().endsWith('.csv')) return callback(new Error('Only CSV files are allowed'));
  callback(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.post('/', requireAdmin, upload.single('file'), uploadFile);
export default router;
