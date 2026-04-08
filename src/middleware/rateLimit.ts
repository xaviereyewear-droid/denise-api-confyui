/**
 * MIDDLEWARE DE RATE LIMITING
 */

import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

/**
 * Rate limiter por IP (para requisições sem autenticação)
 * Máximo de requisições por janela de tempo
 */
export const ipLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minuto
  max: config.rateLimit.maxRequests, // máx 10 requisições
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Limite de requisições atingido. Tente novamente depois.',
    retry_after: config.rateLimit.windowMs / 1000,
  },
  statusCode: 429,
  skip: (req) => {
    // Não limitar rotas de health check
    return req.path === '/health' || req.path === '/health/comfyui';
  },
});

/**
 * Rate limiter para upload de arquivos
 * Mais restritivo que o limiter geral
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // máx 20 uploads por minuto (aumentado para testes)
  message: {
    status: 'error',
    code: 'UPLOAD_LIMIT_EXCEEDED',
    message: 'Muitos uploads simultâneos. Aguarde um momento.',
  },
  statusCode: 429,
});

/**
 * Rate limiter leve para health checks
 * Permite muitos checks mas não permite abuso
 */
export const healthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 checks por minuto são OK
  statusCode: 429,
});
