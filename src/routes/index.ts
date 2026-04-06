/**
 * ROUTER PRINCIPAL DA API
 */

import { Router, Request, Response } from 'express';
import { healthLimiter } from '../middleware/rateLimit.js';
import logger from '../lib/logger.js';
import comfyuiService from '../services/comfyuiService.js';
import jobService from '../services/jobService.js';
import storageService from '../services/storageService.js';
import aiRoutes from './ai.js';

const router = Router();

/**
 * ROTAS DE IA (com autenticação)
 */
router.use('/', aiRoutes);

/**
 * HEALTH CHECK - Sem autenticação
 * Verificar se a API está funcionando
 */
router.get('/health', healthLimiter, async (_req: Request, res: Response) => {
  try {
    // Verificar conectividade de cada serviço
    const comfyuiHealthy = await comfyuiService.healthCheck();
    const storageUsage = await storageService.getDiskUsage();
    const jobStats = jobService.getStats();

    const allHealthy = comfyuiHealthy;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        comfyui: comfyuiHealthy ? 'connected' : 'disconnected',
        storage: storageUsage.total >= 0 ? 'accessible' : 'inaccessible',
      },
      details: {
        jobs: jobStats,
        storage: {
          used_mb: (storageUsage.total / 1024 / 1024).toFixed(2),
        },
      },
    });

    logger.debug('Health check completo');
  } catch (error) {
    logger.error({ error }, 'Erro no health check');

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: 'Erro ao verificar saúde da API',
    });
  }
});

/**
 * HEALTH CHECK - ComfyUI Status
 * Verificar apenas a conectividade com ComfyUI
 */
router.get('/health/comfyui', healthLimiter, async (_req: Request, res: Response) => {
  try {
    const isConnected = await comfyuiService.healthCheck();

    res.status(isConnected ? 200 : 503).json({
      status: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      comfyui: {
        url: `${process.env.COMFYUI_HOST || 'localhost'}:${process.env.COMFYUI_PORT || '8188'}`,
        reachable: isConnected,
      },
      message: isConnected
        ? 'ComfyUI está respondendo'
        : 'ComfyUI não está respondendo. Verifique se está rodando.',
    });

    logger.debug(`ComfyUI health: ${isConnected ? 'OK' : 'DOWN'}`);
  } catch (error) {
    logger.error({ error }, 'Erro ao verificar ComfyUI');

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Erro ao verificar ComfyUI',
    });
  }
});

/**
 * API Stats - Sem autenticação
 * Estatísticas gerais da API
 */
router.get('/stats', healthLimiter, async (_req: Request, res: Response) => {
  try {
    const jobStats = jobService.getStats();
    const storageUsage = await storageService.getDiskUsage();

    res.status(200).json({
      timestamp: new Date().toISOString(),
      jobs: jobStats,
      storage: {
        uploads_mb: (storageUsage.uploads / 1024 / 1024).toFixed(2),
        outputs_mb: (storageUsage.outputs / 1024 / 1024).toFixed(2),
        total_mb: (storageUsage.total / 1024 / 1024).toFixed(2),
      },
    });

    logger.debug('Stats endpoint acessado');
  } catch (error) {
    logger.error({ error }, 'Erro ao obter stats');

    res.status(500).json({
      status: 'error',
      message: 'Erro ao obter estatísticas',
    });
  }
});

export default router;
