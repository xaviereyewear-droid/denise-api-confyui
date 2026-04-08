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
 * HEALTH CHECK - Ready Probe (Kubernetes)
 * Apenas verifica se a API está UP (sem dependências externas)
 */
router.get('/health/ready', healthLimiter, async (_req: Request, res: Response) => {
  try {
    // Verificar apenas recursos locais
    const storageInfo = await storageService.getInfo();

    const isReady = storageInfo.available;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        storage: storageInfo.available ? 'ok' : 'down',
      },
    });

    if (isReady) {
      logger.debug('Ready probe OK');
    } else {
      logger.warn('Ready probe falhou - storage não disponível');
    }
  } catch (error) {
    logger.error({ err: error }, 'Erro no ready probe');

    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      message: 'Storage Service não disponível',
    });
  }
});

/**
 * HEALTH CHECK - Liveness Probe (Kubernetes)
 * Verifica dependências externas (ComfyUI, etc)
 */
router.get('/health/live', healthLimiter, async (_req: Request, res: Response) => {
  try {
    const comfyuiHealthy = await comfyuiService.healthCheck();

    res.status(comfyuiHealthy ? 200 : 503).json({
      status: comfyuiHealthy ? 'alive' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        comfyui: comfyuiHealthy ? 'connected' : 'disconnected',
      },
      message: comfyuiHealthy
        ? 'API viva e ComfyUI acessível'
        : 'API viva mas ComfyUI offline',
    });

    logger.debug(`Liveness probe: ComfyUI ${comfyuiHealthy ? 'OK' : 'DOWN'}`);
  } catch (error) {
    logger.error({ err: error }, 'Erro no liveness probe');

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: 'Erro ao verificar ComfyUI',
    });
  }
});

/**
 * HEALTH CHECK - Completo (compatível com versão anterior)
 * Agrupa ready + live checks
 */
router.get('/health', healthLimiter, async (_req: Request, res: Response) => {
  try {
    const comfyuiHealthy = await comfyuiService.healthCheck();
    const storageInfo = await storageService.getInfo();
    const storageUsage = await storageService.getDiskUsage();
    const jobStats = jobService.getStats();

    const isReady = storageInfo.available;
    const isAlive = comfyuiHealthy;
    const overallHealthy = isReady && isAlive;

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        ready: isReady ? 'ok' : 'down',
        live: isAlive ? 'ok' : 'down',
      },
      services: {
        api: 'running',
        comfyui: isAlive ? 'connected' : 'disconnected',
        storage: isReady ? 'accessible' : 'inaccessible',
      },
      details: {
        jobs: jobStats,
        storage: {
          used_mb: (storageUsage.total / 1024 / 1024).toFixed(2),
        },
      },
    });

    logger.debug(`Health check: ${overallHealthy ? 'healthy' : 'unhealthy'}`);
  } catch (error) {
    logger.error({ err: error }, 'Erro no health check');

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      message: 'Erro ao verificar saúde da API',
    });
  }
});

/**
 * HEALTH CHECK - ComfyUI Status (Alias para /health/live)
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
    logger.error({ err: error }, 'Erro ao verificar ComfyUI');

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
    let storageUsage = { uploads: 0, outputs: 0, total: 0 };

    try {
      storageUsage = await storageService.getDiskUsage();
    } catch (error) {
      logger.warn(
        { err: error },
        'Erro ao obter disk usage, usando 0'
      );
    }

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
    logger.error({ err: error }, 'Erro ao obter stats');

    res.status(500).json({
      status: 'error',
      message: 'Erro ao obter estatísticas',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
