/**
 * SERVIÇO DE GERENCIAMENTO DE JOBS
 *
 * Responsável por:
 * - Armazenar estado dos jobs
 * - Atualizar status
 * - Recuperar resultado
 * - Limpeza automática
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import config from '../config/env.js';
import logger from '../lib/logger.js';
import { Job, JobStatus } from '../types/index.js';
import { ComfyUIHistory } from '../types/comfyui.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Storage em memória para MVP
 * TODO: Migrar para SQLite/PostgreSQL em produção
 */
class JobStorage {
  private jobs: Map<string, Job> = new Map();

  create(job: Job): void {
    this.jobs.set(job.id, job);
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  update(jobId: string, partial: Partial<Job>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job, partial);
  }

  delete(jobId: string): void {
    this.jobs.delete(jobId);
  }

  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }

  getByStatus(status: JobStatus): Job[] {
    return this.getAll().filter(job => job.status === status);
  }
}

/**
 * Serviço de Jobs
 */
class JobService {
  private storage: JobStorage;

  constructor() {
    this.storage = new JobStorage();
    this.startCleanupInterval();
  }

  /**
   * Criar novo job
   */
  createJob(
    jobId: string,
    workflowType: string,
    inputImagePath: string,
    comfyuiPromptId: string
  ): Job {
    const job: Job = {
      id: jobId,
      status: 'queued',
      workflowType: workflowType as any,
      inputImagePath,
      comfyuiPromptId,
      createdAt: new Date(),
      progress: 0,
    };

    this.storage.create(job);

    logger.info(
      { jobId, workflowType, promptId: comfyuiPromptId },
      'Job criado'
    );

    return job;
  }

  /**
   * Obter job por ID
   */
  getJob(jobId: string): Job | undefined {
    return this.storage.get(jobId);
  }

  /**
   * Atualizar status do job
   */
  updateJobStatus(jobId: string, status: JobStatus, progress: number = 0): void {
    this.storage.update(jobId, { status, progress, updatedAt: new Date() });
  }

  /**
   * Marcar job como iniciado
   */
  startJob(jobId: string): void {
    this.storage.update(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0,
    });
  }

  /**
   * Marcar job como completo
   */
  completeJob(jobId: string, outputImagePath: string): void {
    this.storage.update(jobId, {
      status: 'completed',
      completedAt: new Date(),
      outputImagePath,
      progress: 100,
    });

    logger.info({ jobId }, 'Job concluído com sucesso');
  }

  /**
   * Marcar job como falhado
   */
  failJob(jobId: string, errorMessage: string): void {
    this.storage.update(jobId, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage,
      progress: 0,
    });

    logger.warn({ jobId, error: errorMessage }, 'Job falhou');
  }

  /**
   * Cancelar job
   */
  cancelJob(jobId: string): void {
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

    this.storage.update(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    logger.info({ jobId }, 'Job cancelado');
  }

  /**
   * Atualizar progresso
   */
  updateProgress(jobId: string, progress: number): void {
    if (progress < 0 || progress > 100) return;

    this.storage.update(jobId, { progress });
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
    const now = new Date();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 horas

    const jobs = this.storage.getAll();

    for (const job of jobs) {
      // Pular jobs em progresso
      if (job.status === 'queued' || job.status === 'processing') {
        continue;
      }

      // Verificar idade
      const ageMs = now.getTime() - job.completedAt!.getTime();

      if (ageMs > maxAgeMs) {
        try {
          // Deletar arquivo se existir
          if (job.outputImagePath) {
            try {
              await fs.unlink(job.outputImagePath);
            } catch {
              // Arquivo pode já ter sido deletado
            }
          }

          // Remover job do storage
          this.storage.delete(job.id);

          logger.info({ jobId: job.id }, 'Job antigo removido');
        } catch (error) {
          logger.warn({ jobId: job.id, error }, 'Erro ao limpar job');
        }
      }
    }
  }

  /**
   * Obter posição na fila
   */
  getQueuePosition(jobId: string): number {
    const queuedJobs = this.storage.getByStatus('queued');
    const index = queuedJobs.findIndex(j => j.id === jobId);

    return index >= 0 ? index + 1 : -1;
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    const jobs = this.storage.getAll();

    return {
      total: jobs.length,
      queued: jobs.filter(j => j.status === 'queued').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }
}

// Instância única
export const jobService = new JobService();

export default jobService;
