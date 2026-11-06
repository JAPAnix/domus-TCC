import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import { uploadImage, deleteImage } from '../controllers/uploadController.js';
import { MAX_IMAGE_BYTES } from '../utils/imageFile.js';

const router = Router();
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 } }).single('file');

const LIMIT = 60;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function uploadRateLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const entry = attempts.get(req.user.uuid) ?? { count: 0, until: now + WINDOW_MS };
  entry.count += 1;
  attempts.set(req.user.uuid, entry);
  if (entry.count > LIMIT) {
    return res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000))).status(429).json({ message: 'Muitos envios em pouco tempo. Aguarde alguns minutos.' });
  }
  next();
}

function receiveFile(req, res, next) {
  parser(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'A imagem deve ter no máximo 5 MB.' });
    if (err instanceof multer.MulterError) return res.status(400).json({ message: 'Envie apenas uma imagem por vez.' });
    next(err);
  });
}

router.post('/', authMiddleware, uploadRateLimit, receiveFile, uploadImage);
router.delete('/', authMiddleware, deleteImage);

export default router;
