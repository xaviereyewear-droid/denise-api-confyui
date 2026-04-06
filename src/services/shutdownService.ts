/**
 * GRACEFUL SHUTDOWN SERVICE
 *
 * Gerencia shutdown seguro da API
 * - Parar de aceitar requisições
 * - Aguardar jobs em progresso
 * - Fechar recursos
 */

import { Server } from 'http';
import logger from '../lib/logger.js';
import { closeDatabase } from '../db/database.js';
import jobService from './jobService.js';

export interface ShutdownOptions {
  timeoutMs?: number; // Timeout para jobs terminarem
  signal?: NodeJS.Signals;
}

const DEFAULT_TIMEOUT_MS = 30 * 1000; // 30 segundos

/**
 * Gerenciar shutdown gracioso
 */
export class GracefulShutdown {
  private isShuttingDown = false;
  private activeRequests = 0;

  constructor(private server: Server) {}

  /**
   * Registrar shutdown handler
   */
  registerSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    for (const signal of signals) {
      process.on(signal, () => this.shutdown(signal));
    }

    logger.info('Shutdown handlers registrados');
  }

  /**
   * Executar shutdown gracioso
   */
  async shutdown(signal: NodeJS.Signals, timeoutMs?: number): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown já em progresso');
      return;
    }

    this.isShuttingDown = true;
    const timeout = timeoutMs || DEFAULT_TIMEOUT_MS;

    logger.warn({ signal, timeoutMs: timeout }, `Shutdown iniciado (${signal})`);

    try {
      // Passo 1: Parar de aceitar novas conexões
      await this.stopAcceptingConnections(timeout);

      // Passo 2: Aguardar jobs em progresso
      await this.waitForActiveJobs(timeout);

      // Passo 3: Fechar recursos
      await this.closeResources();

      logger.info('✅ Shutdown gracioso completo');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, '❌ Erro durante shutdown');
      process.exit(1);
    }
  }

  /**
   * Parar de aceitar novas conexões
   */
  private async stopAcceptingConnections(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      logger.info('Parando de aceitar novas conexões...');

      const closeTimeout = setTimeout(() => {
        logger.warn(
          { timeoutMs },
          `Timeout ao fechar conexões (${timeoutMs}ms)`
        );
        resolve();
      }, timeoutMs);

      this.server.close(() => {
        clearTimeout(closeTimeout);
        logger.info('✅ Servidor HTTP fechado');
        resolve();
      });
    });
  }

  /**
   * Aguardar jobs em progresso
   */
  private async waitForActiveJobs(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const stats = jobService.getStats();
    const activeJobs = stats.queued + stats.processing;

    if (activeJobs === 0) {
      logger.info('Nenhum job ativo');
      return;
    }

    logger.info(
      { activeJobs, timeoutMs },
      `Aguardando ${activeJobs} jobs terminarem...`
    );

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const stats = jobService.getStats();
        const active = stats.queued + stats.processing;

        if (active === 0) {
          clearInterval(checkInterval);
          logger.info('✅ Todos os jobs terminaram');
          resolve();
          return;
        }

        if (elapsed > timeoutMs) {
          clearInterval(checkInterval);
          logger.warn(
            { activeJobs: active, elapsed, timeout: timeoutMs },
            `⚠️  Timeout aguardando jobs (${active} ainda ativos)`
          );
          resolve();
          return;
        }

        logger.debug({ activeJobs: active, elapsed }, 'Aguardando jobs...');
      }, 1000); // Checar a cada segundo
    });
  }

  /**
   * Fechar recursos
   */
  private async closeResources(): Promise<void> {
    logger.info('Fechando recursos...');

    try {
      // Fechar banco de dados
      closeDatabase();
      logger.info('✅ Banco de dados fechado');

      // Adicionar mais recursos conforme necessário
    } catch (error) {
      logger.error({ error }, 'Erro ao fechar recursos');
      throw error;
    }
  }

  /**
   * Registrar requisição ativa
   */
  recordActiveRequest(): void {
    if (!this.isShuttingDown) {
      this.activeRequests++;
    }
  }

  /**
   * Deregistrar requisição ativa
   */
  recordInactiveRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Verificar se está desligando
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Instância global
 */
let shutdownInstance: GracefulShutdown | null = null;

/**
 * Inicializar graceful shutdown
 */
export function initializeGracefulShutdown(server: Server): GracefulShutdown {
  if (!shutdownInstance) {
    shutdownInstance = new GracefulShutdown(server);
    shutdownInstance.registerSignalHandlers();
  }
  return shutdownInstance;
}

/**
 * Obter instância
 */
export function getGracefulShutdown(): GracefulShutdown {
  if (!shutdownInstance) {
    throw new Error('GracefulShutdown não foi inicializado');
  }
  return shutdownInstance;
}

export default GracefulShutdown;
