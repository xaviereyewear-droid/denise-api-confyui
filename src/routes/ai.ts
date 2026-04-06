/**
 * ROTAS DE AI
 *
 * Endpoints:
 * POST   /api/ai/submit   - Enviar imagem
 * GET    /api/ai/status   - Status do job
 * GET    /api/ai/result   - Baixar resultado
 * DELETE /api/ai/job      - Cancelar job
 */

import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/env.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import AIController from '../controllers/aiController.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * Configuração do Multer para upload de arquivos
 */
const upload = multer({
  storage: multer.memoryStorage(), // Salvar em memória (enviamos ao Storage depois)
  limits: {
    fileSize: config.uploadMaxSize, // 10MB por padrão
    files: 1, // Apenas 1 arquivo por vez
  },
  fileFilter: (_req, file, cb) => {
    // Validar MIME type básico
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          'INVALID_MIME_TYPE',
          `MIME type não aceito: ${file.mimetype}. Aceitos: ${allowedMimes.join(', ')}`
        )
      );
    }
  },
});

/**
 * Middleware para tratar erros do Multer
 */
const handleMulterError = asyncHandler(async (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        throw new ApiError(
          413,
          'FILE_TOO_LARGE',
          `Arquivo muito grande. Máximo: ${(config.uploadMaxSize / 1024 / 1024).toFixed(1)}MB`
        );
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        throw new ApiError(400, 'TOO_MANY_FILES', 'Apenas 1 arquivo por vez');
      }

      throw new ApiError(400, 'UPLOAD_ERROR', err.message);
    }

    if (err) throw err;

    next();
  });
});

/**
 * POST /api/ai/submit
 * Enviar imagem para processamento
 *
 * Request:
 *   Content-Type: multipart/form-data
 *   Authorization: Bearer <token>
 *   Body:
 *     - image: <arquivo>
 *     - workflow: "catalog" | "portrait" | "custom"
 *
 * Response (202):
 *   {
 *     "status": "queued",
 *     "job_id": "job_abc123",
 *     "message": "Imagem recebida...",
 *     "estimated_wait": "2-5 minutes",
 *     "polling_url": "/api/ai/status/job_abc123"
 *   }
 */
router.post(
  '/ai/submit',
  authMiddleware, // Verificar token
  uploadLimiter, // Rate limit para uploads
  handleMulterError, // Processar upload
  AIController.submitJob // Controlador
);

/**
 * GET /api/ai/status/:jobId
 * Verificar status do processamento
 *
 * Request:
 *   Authorization: Bearer <token>
 *
 * Response (200):
 *   {
 *     "job_id": "job_abc123",
 *     "status": "processing",
 *     "progress": 65,
 *     "message": "Processando... 65% concluído",
 *     "created_at": "2026-04-06T20:30:00Z",
 *     "started_at": "2026-04-06T20:31:00Z"
 *   }
 */
router.get(
  '/ai/status/:jobId',
  authMiddleware, // Verificar token
  AIController.getStatus // Controlador
);

/**
 * GET /api/ai/result/:jobId
 * Baixar imagem processada
 *
 * Request:
 *   Authorization: Bearer <token>
 *
 * Response (200):
 *   [Binary image data]
 *   Content-Type: image/png
 *
 * Response (202 - ainda processando):
 *   {
 *     "status": "not_ready",
 *     "current_status": "processing",
 *     "progress": 75,
 *     "retry_after": 5
 *   }
 */
router.get(
  '/ai/result/:jobId',
  authMiddleware, // Verificar token
  AIController.getResult // Controlador
);

/**
 * DELETE /api/ai/job/:jobId
 * Cancelar processamento
 *
 * Request:
 *   Authorization: Bearer <token>
 *
 * Response (200):
 *   {
 *     "status": "cancelled",
 *     "job_id": "job_abc123",
 *     "message": "Job cancelado com sucesso",
 *     "previous_status": "processing"
 *   }
 */
router.delete(
  '/ai/job/:jobId',
  authMiddleware, // Verificar token
  AIController.cancelJob // Controlador
);

export default router;
