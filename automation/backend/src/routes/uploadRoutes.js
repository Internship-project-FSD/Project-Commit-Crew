import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadFile } from '../controllers/uploadController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INCOMING_DIR = path.join(__dirname, '../../../../downloads/incoming');

const storage = multer.diskStorage({
  destination: INCOMING_DIR,
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.originalname.toLowerCase().endsWith('.csv')) {
    return cb(new Error('Only CSV files are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }  // 10 MB max
});

const router = Router();

router.post('/', upload.single('file'), uploadFile);

export default router;
