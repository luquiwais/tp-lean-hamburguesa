import multer from 'multer';
import { badRequest } from '../lib/errors';

// Subida de imagenes en memoria (nunca toca el disco). El mimetype del
// cliente es solo un primer filtro: el service valida el contenido real con
// sharp antes de guardar nada.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Formato no permitido: subi JPG, PNG o WebP'));
  },
}).single('image');
