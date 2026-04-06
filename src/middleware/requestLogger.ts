/**
 * REQUEST LOGGER MIDDLEWARE
 *
 * Registra requisições HTTP com duração e atualiza métricas
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger.js';
import { metrics } from '../services/metricsService.js';

/**
 * Middleware para logar requisições
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Armazenar informações na request
  (req as any).requestId = requestId;
  (req as any).startTime = startTime;

  // Capturar quando response é enviada
  const originalSend = res.send;

  res.send = function (data) {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Limpar path de parâmetros dinâmicos para agrupar métricas
    const pathForMetrics = req.path
      .replace(/\/job_[a-f0-9-]+/g, '/:jobId')
      .replace(/\/[a-f0-9]{32,}/g, '/:id');

    // Registrar na métrica
    metrics.recordHttpRequest(req.method, pathForMetrics, statusCode, durationMs);

    // Log estruturado
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const logFn = logger[logLevel as keyof typeof logger];

    logFn(
      {
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode,
        durationMs,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      },
      `${req.method} ${req.path} → ${statusCode} (${durationMs}ms)`
    );

    // Chamar send original
    return originalSend.call(this, data);
  };

  next();
}

export default requestLoggerMiddleware;
