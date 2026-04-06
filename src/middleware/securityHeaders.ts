/**
 * SECURITY HEADERS MIDDLEWARE
 *
 * Adiciona headers de segurança recomendados
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para adicionar security headers
 */
export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevenir XSS em navegadores antigos
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy (stricto, apenas nosso próprio conteúdo)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );

  // HSTS (HTTP Strict Transport Security)
  // Requer HTTPS em futuro deploy
  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Remover header X-Powered-By
  res.removeHeader('X-Powered-By');

  // Desabilitar caching para APIs
  if (res.req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

export default securityHeadersMiddleware;
