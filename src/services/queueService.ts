/**
 * QUEUE SERVICE
 *
 * Gerencia fila de jobs com BullMQ
 * - Enqueue: adicionar jobs à fila
 * - Worker: processar jobs
 * - Retry automático (nativo BullMQ)
 * - Eventos: job:started, job:completed, job:failed
 *
 * SQLite = fonte de verdade (metadata)
 * Redis/BullMQ = fila de processamento
 */

import bullmq from 'bullmq';
import { getRedis } from './redisService.js';
import logger from '../lib/logger.js';
import jobService from './jobService.js';
import comfyuiService from './comfyuiService.js';
import { metrics } from './metricsService.js';

const { Queue, Worker } = bullmq;

/**
 * Interface do job na fila
 */
export interface QueueJobData {
  jobId: string;
  workflow: string;
  inputImagePath: string;
}

/**
 * Queue Service
 */
export class QueueService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private worker: any = null;
  private isProcessing = false;

  /**
   * Inicializar queue e worker
   */
  async initialize(
    concurrency: number = 1,
    processJobFn?: (data: QueueJobData) => Promise<void>
  ): Promise<void> {
    try {
      const redis = getRedis();
      const queueName = 'comfyui-jobs';

      logger.info(
        { queueName, concurrency },
        'Inicializando BullMQ Queue...'
      );

      // Criar queue
      // @ts-ignore - Type mismatch entre versões de BullMQ
      this.queue = new Queue<QueueJobData>(queueName, { connection: redis });

      // Criar worker com concurrency
      // @ts-ignore - BullMQ type mismatch
      this.worker = new Worker<QueueJobData>(
        queueName,
        // @ts-ignore
        processJobFn || ((job) => this.defaultProcessJob(job.data)),
        {
          connection: redis,
          concurrency,
          settings: {
            // Retry automático
            retryProcessDelay: 5000, // 5s entre retries
            maxRetriesPerDay: 3,
          },
        }
      );

      // Registrar event handlers
      this.setupEventHandlers();

      this.isProcessing = true;

      logger.info('✅ BullMQ Queue inicializado');
    } catch (error) {
      logger.error({ error }, 'Erro ao inicializar Queue');
      throw error;
    }
  }

  /**
   * Configurar event handlers
   */
  private setupEventHandlers(): void {
    if (!this.worker) return;

    /**
     * Job completado com sucesso
     */
    this.worker.on('completed', (job: any) => {
      logger.info({ jobId: job.data.jobId }, '✅ Job completado (worker)');
      metrics.recordCircuitBreakerTrip('job-completed');

      // Emitir evento
      this.emit('job:completed', {
        jobId: job.data.jobId,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Job falhado
     */
    this.worker.on('failed', (job: any, error: any) => {
      if (!job) return;

      logger.error(
        { jobId: job.data.jobId, error: error?.message, attempts: job.attemptsMade },
        `❌ Job falhado (tentativa ${job.attemptsMade}/3)`
      );

      // Se não há mais retries, marcar como falhado em SQLite
      if (job.attemptsMade >= 3) {
        jobService.failJob(
          job.data.jobId,
          `Falha após ${job.attemptsMade} tentativas: ${error?.message}`
        );

        this.emit('job:failed', {
          jobId: job.data.jobId,
          error: error?.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        // BullMQ vai requeue automaticamente
        logger.info(
          { jobId: job.data.jobId, nextRetryMs: job.delay },
          `⏳ Job será retentado automaticamente`
        );
      }
    });

    /**
     * Job iniciado
     */
    this.worker.on('active', (job: any) => {
      logger.info(
        { jobId: job.data.jobId },
        '🔄 Job iniciado no worker'
      );

      jobService.startJob(job.data.jobId);

      this.emit('job:started', {
        jobId: job.data.jobId,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Erro no worker (não job específico)
     */
    this.worker.on('error', (error: Error) => {
      logger.error({ error }, '❌ Erro no worker');
    });
  }

  /**
   * Processar job (padrão)
   */
  private async defaultProcessJob(data: QueueJobData): Promise<void> {
    const { jobId, workflow, inputImagePath } = data;

    try {
      logger.info({ jobId, workflow }, 'Processando job...');

      // Criar workflow
      const workflowObject = comfyuiService.createWorkflow({
        type: workflow as any,
        inputImagePath,
        options: { quality: 'high' },
      });

      // Verificar ComfyUI disponível
      const isConnected = await comfyuiService.healthCheck();
      if (!isConnected) {
        throw new Error('ComfyUI não está respondendo');
      }

      // Submeter ao ComfyUI
      const promptId = await comfyuiService.submitWorkflow(workflowObject);
      logger.info(
        { jobId, promptId },
        'Workflow submetido ao ComfyUI'
      );

      // Atualizar job com promptId
      jobService.createJob(jobId, workflow, inputImagePath, 'processing');

      // Aguardar conclusão
      let completed = false;
      let attempts = 0;
      const maxAttempts = 300; // 5 minutos com polling de 1s

      while (!completed && attempts < maxAttempts) {
        const status = await comfyuiService.getStatus(promptId);

        if (status.status === 'completed' && status.result) {
          const imagePath = comfyuiService.extractImagePath(status.result);
          if (imagePath) {
            jobService.completeJob(jobId, imagePath);
            logger.info({ jobId }, '✅ Job processado com sucesso');
            completed = true;
            break;
          }
        } else if (status.status === 'failed') {
          throw new Error('ComfyUI retornou falha');
        }

        // Atualizar progresso
        if (status.progress !== undefined) {
          jobService.updateProgress(jobId, status.progress);
        }

        // Aguardar antes de próximo polling
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!completed) {
        throw new Error(`Timeout aguardando processamento (${maxAttempts}s)`);
      }
    } catch (error) {
      logger.error({ jobId, error }, 'Erro ao processar job');
      throw error; // BullMQ vai requeue automaticamente
    }
  }

  /**
   * Enfileirar novo job
   */
  async enqueueJob(data: QueueJobData): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue não foi inicializado');
    }

    try {
      await this.queue.add('process-job', data, {
        // Configuração de retry
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s inicial, dobra a cada retry
        },
        // TTL para job na queue (24h)
        removeOnComplete: true,
        removeOnFail: false,
      });

      logger.info({ jobId: data.jobId }, 'Job enfileirado com sucesso');
      metrics.recordCircuitBreakerTrip('job-enqueued');
    } catch (error) {
      logger.error({ error, jobId: data.jobId }, 'Erro ao enfileirar job');
      throw error;
    }
  }

  /**
   * Obter estatísticas da fila
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    if (!this.queue) return null;

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error({ error }, 'Erro ao obter stats da queue');
      return null;
    }
  }

  /**
   * Obter health da queue
   */
  async getQueueHealth(): Promise<boolean> {
    if (!this.queue) return false;

    try {
      // @ts-ignore - Ping method type issue
      await (this.queue as any).client.ping();
      return true;
    } catch (error) {
      logger.error({ error }, 'Queue health check falhou');
      return false;
    }
  }

  /**
   * Parar queue e worker
   */
  async stop(): Promise<void> {
    try {
      logger.info('Parando Queue...');

      if (this.worker) {
        await this.worker.close();
      }

      if (this.queue) {
        await this.queue.close();
      }

      this.isProcessing = false;
      logger.info('✅ Queue parado');
    } catch (error) {
      logger.error({ error }, 'Erro ao parar Queue');
    }
  }

  /**
   * Emitter simples para eventos
   */
  private eventHandlers: Record<string, Function[]> = {};

  on(event: string, handler: Function): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  private emit(event: string, data: any): void {
    if (this.eventHandlers[event]) {
      for (const handler of this.eventHandlers[event]) {
        try {
          handler(data);
        } catch (error) {
          logger.error({ error, event }, 'Erro em event handler');
        }
      }
    }
  }

  /**
   * Verificar se está processando
   */
  isRunning(): boolean {
    return this.isProcessing;
  }
}

/**
 * Instância singleton
 */
let queueInstance: QueueService | null = null;

/**
 * Inicializar queue service
 */
export function initializeQueueService(concurrency: number = 1): QueueService {
  if (!queueInstance) {
    queueInstance = new QueueService();
    queueInstance
      .initialize(concurrency)
      .catch((error) => {
        logger.error({ error }, 'Falha ao inicializar queue service');
      });
  }
  return queueInstance;
}

/**
 * Obter instância
 */
export function getQueueService(): QueueService {
  if (!queueInstance) {
    throw new Error('Queue Service não foi inicializado');
  }
  return queueInstance;
}

export default QueueService;
