/**
 * MIDDLEWARE DE AUTENTICAÇÃO COM BEARER TOKEN
 */

import { Request, Response, NextFunction } from 'express';
import config from '../config/env.js';
import logger from '../lib/logger.js';

/**
 * Interface estendida do Request com dados do usuário
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      token?: string;
    }
  }
}

/**
 * Middleware de validação de token Bearer
 *
 * Espera header: Authorization: Bearer sk_live_abc123
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Verificar se header existe
  if (!authHeader) {
    logger.warn({ path: req.path }, 'Requisição sem token de autenticação');
    res.status(401).json({
      status: 'error',
      code: 'MISSING_TOKEN',
      message: 'Token de autenticação obrigatório. Use header: Authorization: Bearer <token>',
    });
    return;
  }

  // Extrair token do formato "Bearer TOKEN"
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    logger.warn({ path: req.path }, 'Formato de token inválido');
    res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN_FORMAT',
      message: 'Formato inválido. Use: Authorization: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  // Validar token (simples comparação por enquanto)
  // TODO: Implementar JWT no futuro
  if (token !== config.apiKey) {
    logger.warn({ token: token.substring(0, 10) + '...' }, 'Token inválido');
    res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Token inválido ou expirado.',
    });
    return;
  }

  // Token válido - armazenar no request para uso posterior
  req.token = token;
  req.userId = 'user_default'; // Simplificado para MVP

  logger.debug({ userId: req.userId }, 'Autenticação bem-sucedida');

  next();
}

/**
 * Middleware para rotas que não requerem autenticação
 * (apenas registra a requisição)
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const token = parts[1];
      if (token === config.apiKey) {
        req.token = token;
        req.userId = 'user_default';
      }
    }
  }

  next();
}
