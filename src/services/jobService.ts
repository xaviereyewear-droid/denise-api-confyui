/**
 * SERVIÇO DE GERENCIAMENTO DE JOBS
 *
 * Responsável por:
 * - Armazenar estado dos jobs (em BD via repository)
 * - Atualizar status
 * - Recuperar resultado
 * - Limpeza automática
 *
 * ETAPA 9: Agora persiste em SQLite via JobRepository
 */

import { promises as fs } from 'fs';
import config from '../config/env.js';
import logger from '../lib/logger.js';
import { Job as OldJob, JobStatus } from '../types/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { Job } from '../models/Job.js';
import { JobRepository } from '../repositories/jobRepository.js';
import { getDatabase } from '../db/database.js';
import { createJobRepository } from '../repositories/jobRepository.js';

/**
 * Serviço de Jobs
 * Combina cache em memória + persistência em BD
 */
class JobService {
  private repository: JobRepository;
  private jobCache: Map<string, Job> = new Map(); // Cache em memória para performance

  constructor() {
    // Lazy initialization para evitar dependências circulares
    this.repository = null as any;
    this.startCleanupInterval();
  }

  /**
   * Inicializar repository (chamado no startup)
   */
  initRepository(): void {
    if (!this.repository) {
      const db = getDatabase();
      this.repository = createJobRepository(db);
      logger.info('JobService integrado com SQLite');
    }
  }

  /**
   * Garantir repository inicializado
   */
  private ensureRepository(): JobRepository {
    if (!this.repository) {
      this.initRepository();
    }
    return this.repository;
  }

  /**
   * Criar novo job
   * IMPORTANTE: Mantém mesma interface, mas agora persiste em BD
   */
  createJob(
    jobId: string,
    workflowType: string,
    inputImagePath: string,
    initialStatus: JobStatus = 'pending'
  ): Job {
    try {
      const repository = this.ensureRepository();

      // Criar job no BD
      const job = repository.create(jobId, {
        workflow: workflowType as any,
        inputImagePath,
      });

      // Atualize status se necessário
      if (initialStatus !== 'pending') {
        repository.setStatus(jobId, initialStatus);
        job.status = initialStatus;
      }

      // Cache em memória
      this.jobCache.set(jobId, job);

      logger.info(
        { jobId, workflowType, status: initialStatus },
        'Job criado'
      );

      return job;
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao criar job');
      throw error;
    }
  }

  /**
   * Obter job por ID
   * Tenta cache primeiro, depois BD
   */
  getJob(jobId: string): Job | null {
    try {
      // Verificar cache
      if (this.jobCache.has(jobId)) {
        return this.jobCache.get(jobId)!;
      }

      // Buscar no BD
      const repository = this.ensureRepository();
      const job = repository.getById(jobId);

      if (job) {
        // Cachear
        this.jobCache.set(jobId, job);
        return job;
      }

      return null;
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao obter job');
      return null;
    }
  }

  /**
   * Marcar job como iniciado
   */
  startJob(jobId: string): void {
    try {
      const repository = this.ensureRepository();
      repository.setStartedAt(jobId);

      // Invalidar cache
      this.jobCache.delete(jobId);

      logger.info({ jobId }, 'Job iniciado');
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao iniciar job');
    }
  }

  /**
   * Marcar job como completo
   */
  completeJob(jobId: string, outputImagePath: string): void {
    try {
      const repository = this.ensureRepository();
      repository.setCompletedAt(jobId, outputImagePath);

      // Invalidar cache
      this.jobCache.delete(jobId);

      logger.info({ jobId }, 'Job concluído com sucesso');
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao completar job');
    }
  }

  /**
   * Marcar job como falhado
   */
  failJob(jobId: string, errorMessage: string): void {
    try {
      const repository = this.ensureRepository();
      repository.setError(jobId, errorMessage);

      // Invalidar cache
      this.jobCache.delete(jobId);

      logger.warn({ jobId, error: errorMessage }, 'Job falhou');
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao falhar job');
    }
  }

  /**
   * Cancelar job
   */
  cancelJob(jobId: string): void {
    try {
      const job = this.getJob(jobId);

      if (!job) {
        throw new ApiError(404, 'JOB_NOT_FOUND', 'Job não encontrado');
      }

      if (job.status === 'completed' || job.status === 'failed') {
        throw new ApiError(
          409,
          'CANNOT_CANCEL',
          'Job já está concluído. Não pode ser cancelado.'
        );
      }

      const repository = this.ensureRepository();
      repository.cancel(jobId);

      // Invalidar cache
      this.jobCache.delete(jobId);

      logger.info({ jobId }, 'Job cancelado');
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao cancelar job');
      throw error;
    }
  }

  /**
   * Atualizar progresso
   */
  updateProgress(jobId: string, progress: number): void {
    try {
      if (progress < 0 || progress > 100) return;

      const repository = this.ensureRepository();
      repository.setProgress(jobId, progress);

      // Invalidar cache para próxima leitura
      this.jobCache.delete(jobId);
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao atualizar progresso');
    }
  }

  /**
   * Limpeza automática de jobs antigos
   * Remove jobs completados/falhados após 24h
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldJobs();
    }, config.cleanupInterval);
  }

  /**
   * Executar limpeza
   */
  private async cleanupOldJobs(): Promise<void> {
    try {
      const repository = this.ensureRepository();
      const deleted = repository.cleanupOldJobs(1); // Manter 1 dia apenas

      if (deleted > 0) {
        logger.info({ deleted }, 'Cleanup de jobs antigos executado');
      }
    } catch (error) {
      logger.warn({ error }, 'Erro ao fazer cleanup de jobs');
    }
  }

  /**
   * Obter posição na fila
   */
  getQueuePosition(jobId: string): number {
    try {
      const repository = this.ensureRepository();
      const queuedJobs = repository.list({ status: 'queued' });
      const index = queuedJobs.findIndex((j) => j.id === jobId);

      return index >= 0 ? index + 1 : -1;
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao obter posição na fila');
      return -1;
    }
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    try {
      const repository = this.ensureRepository();
      const stats = repository.countByStatus();

      return {
        total:
          stats.pending +
          stats.queued +
          stats.processing +
          stats.completed +
          stats.failed +
          stats.cancelled,
        queued: stats.queued,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
      };
    } catch (error) {
      logger.error({ error }, 'Erro ao obter stats');
      return {
        total: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
    }
  }
}

// Instância única
export const jobService = new JobService();

export default jobService;
