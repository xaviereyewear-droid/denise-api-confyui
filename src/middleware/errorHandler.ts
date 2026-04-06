/**
 * MIDDLEWARE DE TRATAMENTO DE ERROS
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger.js';

/**
 * Classe customizada para erros de API
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Middleware de tratamento de erros (deve ser o último)
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path }, 'Erro na requisição');

  // Se for um ApiError customizado
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Erro genérico/não esperado
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : err.message;

  res.status(statusCode).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message,
  });
}

/**
 * Middleware para rotas não encontradas (404)
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: 'Rota não encontrada.',
  });
}

/**
 * Wrapper para capturar erros em rotas async
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
