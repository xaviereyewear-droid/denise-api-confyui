/**
 * REDIS SERVICE
 *
 * Gerencia conexão com Redis
 * BullMQ usa Redis como backend para fila durável
 */

import { createClient, RedisClientType } from 'redis';
import logger from '../lib/logger.js';

/**
 * Instância do cliente Redis
 */
let redisClient: RedisClientType | null = null;

/**
 * Inicializar conexão com Redis
 */
export async function initializeRedis(): Promise<RedisClientType> {
  try {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    logger.info({ host, port, db }, 'Conectando ao Redis...');

    redisClient = createClient({
      socket: {
        host,
        port,
      },
      ...(password && { password }),
      db,
    });

    // Event listeners
    redisClient.on('error', (error) => {
      logger.error({ error }, 'Erro de conexão com Redis');
    });

    redisClient.on('connect', () => {
      logger.info('✅ Conectado ao Redis');
    });

    redisClient.on('disconnect', () => {
      logger.warn('Desconectado do Redis');
    });

    // Conectar
    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Erro ao inicializar Redis');
    throw error;
  }
}

/**
 * Obter instância do Redis
 */
export function getRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis não foi inicializado');
  }
  return redisClient;
}

/**
 * Health check do Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!redisClient) return false;
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error({ error }, 'Redis health check falhou');
    return false;
  }
}

/**
 * Fechar conexão com Redis
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.disconnect();
      redisClient = null;
      logger.info('Redis desconectado');
    } catch (error) {
      logger.error({ error }, 'Erro ao desconectar do Redis');
    }
  }
}

/**
 * Obter info do Redis
 */
export async function getRedisInfo(): Promise<Record<string, any> | null> {
  try {
    if (!redisClient) return null;

    const info = await redisClient.info();
    const dbSize = await redisClient.dbSize();

    return {
      connected: true,
      dbSize,
      version: info.split('\r\n').find((line) => line.includes('redis_version'))?.split(':')[1],
    };
  } catch (error) {
    logger.error({ error }, 'Erro ao obter info do Redis');
    return null;
  }
}

export default {
  initializeRedis,
  getRedis,
  checkRedisHealth,
  closeRedis,
  getRedisInfo,
};
