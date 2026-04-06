/**
 * JOB REPOSITORY
 *
 * Data Access Layer para jobs.
 * Abstração entre jobService e banco de dados.
 * Facilita migração SQLite → PostgreSQL depois.
 */

import Database from 'better-sqlite3';
import logger from '../lib/logger.js';
import {
  Job,
  JobRow,
  JobStatus,
  CreateJobInput,
  UpdateJobInput,
  rowToJob,
  jobToRow,
  createNewJob,
  canRecoverJob,
} from '../models/Job.js';

/**
 * Job Repository
 * CRUD operations com transações seguras
 */
export class JobRepository {
  constructor(private db: Database.Database) {}

  /**
   * CREATE: Inserir novo job
   */
  create(id: string, input: CreateJobInput): Job {
    try {
      const job = createNewJob(id, input);
      const row = jobToRow(job);

      const stmt = this.db.prepare(`
        INSERT INTO jobs (
          id, workflow, status, input_image_path, output_image_path,
          comfyui_prompt_id, progress, created_at, started_at,
          completed_at, error_message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        row.workflow,
        row.status,
        row.input_image_path,
        row.output_image_path,
        row.comfyui_prompt_id,
        row.progress,
        row.created_at,
        row.started_at,
        row.completed_at,
        row.error_message,
        row.metadata
      );

      logger.debug({ jobId: id }, 'Job criado no banco de dados');
      return job;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao criar job');
      throw error;
    }
  }

  /**
   * READ: Obter job por ID
   */
  getById(id: string): Job | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
      const row = stmt.get(id) as JobRow | undefined;

      if (!row) {
        return null;
      }

      return rowToJob(row);
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao obter job');
      throw error;
    }
  }

  /**
   * READ: Listar todos os jobs com filtros opcionais
   */
  list(options?: {
    status?: JobStatus;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'started_at';
    order?: 'ASC' | 'DESC';
  }): Job[] {
    try {
      let query = 'SELECT * FROM jobs WHERE 1=1';
      const params: any[] = [];

      if (options?.status) {
        query += ' AND status = ?';
        params.push(options.status);
      }

      const orderBy = options?.orderBy || 'created_at';
      const order = options?.order || 'DESC';
      query += ` ORDER BY ${orderBy} ${order}`;

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as JobRow[];

      return rows.map(rowToJob);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar jobs');
      throw error;
    }
  }

  /**
   * UPDATE: Atualizar job
   */
  update(id: string, input: UpdateJobInput): Job | null {
    try {
      const job = this.getById(id);
      if (!job) return null;

      // Mesclar dados
      const updated: Job = {
        ...job,
        ...input,
        // Timestamps não podem ser sobrescritos diretamente via input
        // Se quiser mudar, use setStartedAt, setCompletedAt, etc
      };

      const row = jobToRow(updated);

      const stmt = this.db.prepare(`
        UPDATE jobs SET
          workflow = ?,
          status = ?,
          input_image_path = ?,
          output_image_path = ?,
          comfyui_prompt_id = ?,
          progress = ?,
          created_at = ?,
          started_at = ?,
          completed_at = ?,
          error_message = ?,
          metadata = ?
        WHERE id = ?
      `);

      stmt.run(
        row.workflow,
        row.status,
        row.input_image_path,
        row.output_image_path,
        row.comfyui_prompt_id,
        row.progress,
        row.created_at,
        row.started_at,
        row.completed_at,
        row.error_message,
        row.metadata,
        id
      );

      logger.debug({ jobId: id }, 'Job atualizado no banco de dados');
      return updated;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao atualizar job');
      throw error;
    }
  }

  /**
   * UPDATE: Mudar status
   */
  setStatus(id: string, status: JobStatus): boolean {
    try {
      const stmt = this.db.prepare('UPDATE jobs SET status = ? WHERE id = ?');
      const result = stmt.run(status, id);
      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao atualizar status');
      throw error;
    }
  }

  /**
   * UPDATE: Atualizar progresso
   */
  setProgress(id: string, progress: number): boolean {
    try {
      const stmt = this.db.prepare('UPDATE jobs SET progress = ? WHERE id = ?');
      const result = stmt.run(Math.min(100, Math.max(0, progress)), id);
      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao atualizar progresso');
      throw error;
    }
  }

  /**
   * UPDATE: Marcar como iniciado
   */
  setStartedAt(id: string): boolean {
    try {
      const stmt = this.db.prepare(
        'UPDATE jobs SET started_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao marcar como iniciado');
      throw error;
    }
  }

  /**
   * UPDATE: Marcar como completo
   */
  setCompletedAt(id: string, outputImagePath: string): boolean {
    try {
      const stmt = this.db.prepare(
        'UPDATE jobs SET completed_at = CURRENT_TIMESTAMP, output_image_path = ?, status = ? WHERE id = ?'
      );
      const result = stmt.run(outputImagePath, 'completed', id);
      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao marcar como completo');
      throw error;
    }
  }

  /**
   * UPDATE: Registrar erro
   */
  setError(id: string, errorMessage: string): boolean {
    try {
      const stmt = this.db.prepare(
        'UPDATE jobs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      const result = stmt.run('failed', errorMessage, id);
      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao registrar erro');
      throw error;
    }
  }

  /**
   * DELETE: Remover job (por enquanto, apenas marca como cancelado)
   */
  cancel(id: string): boolean {
    try {
      const stmt = this.db.prepare(
        'UPDATE jobs SET status = ? WHERE id = ?'
      );
      const result = stmt.run('cancelled', id);
      return result.changes > 0;
    } catch (error) {
      logger.error({ error, jobId: id }, 'Erro ao cancelar job');
      throw error;
    }
  }

  /**
   * STATS: Contar jobs por status
   */
  countByStatus(): Record<JobStatus, number> {
    try {
      const statuses: JobStatus[] = [
        'pending',
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled',
      ];

      const stats: Record<JobStatus, number> = {
        pending: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };

      for (const status of statuses) {
        const stmt = this.db.prepare(
          'SELECT COUNT(*) as count FROM jobs WHERE status = ?'
        );
        const result = stmt.get(status) as { count: number };
        stats[status] = result.count;
      }

      return stats;
    } catch (error) {
      logger.error({ error }, 'Erro ao contar jobs');
      return {
        pending: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
    }
  }

  /**
   * RECOVERY: Obter jobs incompletos (para recovery ao iniciar)
   */
  getIncompleteJobs(): Job[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM jobs
        WHERE status IN ('pending', 'queued', 'processing')
        ORDER BY created_at DESC
      `);

      const rows = stmt.all() as JobRow[];
      return rows.map(rowToJob);
    } catch (error) {
      logger.error({ error }, 'Erro ao obter jobs incompletos');
      return [];
    }
  }

  /**
   * CLEANUP: Remover jobs antigos (arquivamento)
   * Mantém apenas últimos N dias
   */
  cleanupOldJobs(daysToKeep: number = 30): number {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM jobs
        WHERE completed_at < datetime('now', '-' || ? || ' days')
        AND status IN ('completed', 'failed', 'cancelled')
      `);

      const result = stmt.run(daysToKeep);
      logger.info(
        { deletedCount: result.changes, daysToKeep },
        'Jobs antigos removidos'
      );

      return result.changes;
    } catch (error) {
      logger.error({ error }, 'Erro ao fazer cleanup de jobs');
      return 0;
    }
  }
}

/**
 * Factory: Criar instância do repositório
 */
export function createJobRepository(db: Database.Database): JobRepository {
  return new JobRepository(db);
}

export default JobRepository;
