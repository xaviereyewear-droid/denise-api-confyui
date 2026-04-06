/**
 * JOB RECOVERY SERVICE
 *
 * Carrega jobs incompletos ao iniciar a API.
 * Garante que processamentos em andamento continuam após reinicio.
 */

import logger from '../lib/logger.js';
import comfyuiService from './comfyuiService.js';
import jobService from './jobService.js';
import { JobRepository } from '../repositories/jobRepository.js';

/**
 * Job Recovery Service
 * Recupera jobs após restart
 */
export class JobRecoveryService {
  constructor(private repository: JobRepository) {}

  /**
   * Executar recovery ao iniciar
   * - Carregar jobs incompletos do banco
   * - Recarregar em memória (cache)
   * - Verificar status no ComfyUI
   */
  async recoverIncompleteJobs(): Promise<number> {
    try {
      logger.info('🔄 Iniciando recovery de jobs incompletos...');

      // Obter jobs incomplete do banco
      const incompleteJobs = this.repository.getIncompleteJobs();

      if (incompleteJobs.length === 0) {
        logger.info('✅ Nenhum job para recuperar');
        return 0;
      }

      logger.info(
        { count: incompleteJobs.length },
        `Encontrados ${incompleteJobs.length} jobs incompletos`
      );

      let recovered = 0;

      // Processar cada job incompleto
      for (const job of incompleteJobs) {
        try {
          // Recarregar em memória (jobService.createJob)
          jobService.createJob(job.id, job.workflow, job.inputImagePath, job.status);

          // Se tem promptId no ComfyUI, verificar status
          if (job.comfyuiPromptId) {
            try {
              const comfyStatus = await comfyuiService.getStatus(
                job.comfyuiPromptId
              );

              // Atualizar status local baseado em ComfyUI
              if (comfyStatus.status === 'completed' && comfyStatus.result) {
                const imagePath = comfyuiService.extractImagePath(
                  comfyStatus.result
                );
                if (imagePath) {
                  jobService.completeJob(job.id, imagePath);
                  logger.info(
                    { jobId: job.id },
                    'Job completado após recovery'
                  );
                }
              } else if (comfyStatus.status === 'failed') {
                jobService.failJob(job.id, 'Falha detectada na recovery');
                logger.info({ jobId: job.id }, 'Job marcado como falho');
              } else {
                // Ainda processando
                logger.info(
                  { jobId: job.id, status: comfyStatus.status },
                  'Job ainda em processamento'
                );
              }
            } catch (error) {
              // ComfyUI indisponível ou erro - manter job como estava
              logger.warn(
                { jobId: job.id, error },
                'Erro ao verificar status no ComfyUI, mantendo estado'
              );
            }
          } else {
            // Sem promptId ainda - job ainda está pending/queued
            logger.debug(
              { jobId: job.id, status: job.status },
              'Job aguardando submissão ao ComfyUI'
            );
          }

          recovered++;
        } catch (error) {
          logger.error(
            { jobId: job.id, error },
            'Erro ao recuperar job individual'
          );
          // Continuar com próximo job
        }
      }

      logger.info(
        { recovered, total: incompleteJobs.length },
        `✅ Recovery completado: ${recovered}/${incompleteJobs.length} jobs recuperados`
      );

      return recovered;
    } catch (error) {
      logger.error({ error }, '❌ Erro durante job recovery');
      // Não parar startup por causa de recovery error
      return 0;
    }
  }

  /**
   * Cleanup: Remover jobs antigos do banco
   * Opcional - executar periodicamente
   */
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    try {
      logger.info({ daysToKeep }, 'Iniciando cleanup de jobs antigos');
      const deleted = this.repository.cleanupOldJobs(daysToKeep);
      logger.info({ deleted }, 'Cleanup de jobs antigos completado');
      return deleted;
    } catch (error) {
      logger.error({ error }, 'Erro ao fazer cleanup de jobs');
      return 0;
    }
  }

  /**
   * Status: Obter informações sobre banco
   */
  getRecoveryStats() {
    try {
      const incompleteJobs = this.repository.getIncompleteJobs();
      const byStatus = this.repository.countByStatus();

      return {
        totalIncomplete: incompleteJobs.length,
        byStatus,
        lastIncomplete: incompleteJobs[0] || null,
      };
    } catch (error) {
      logger.error({ error }, 'Erro ao obter stats de recovery');
      return null;
    }
  }
}

/**
 * Instância singleton de recovery
 */
let recoveryInstance: JobRecoveryService | null = null;

/**
 * Inicializar job recovery
 */
export function initializeJobRecovery(
  repository: JobRepository
): JobRecoveryService {
  if (!recoveryInstance) {
    recoveryInstance = new JobRecoveryService(repository);
  }
  return recoveryInstance;
}

/**
 * Obter instância do recovery service
 */
export function getJobRecovery(): JobRecoveryService {
  if (!recoveryInstance) {
    throw new Error('Job Recovery não foi inicializado');
  }
  return recoveryInstance;
}

export default JobRecoveryService;
