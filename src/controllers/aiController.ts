/**
 * CONTROLADOR DE AI
 *
 * Responsável por:
 * - Receber requisições HTTP
 * - Validar dados
 * - Chamar serviços
 * - Retornar respostas
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../lib/logger.js';
import config from '../config/env.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import comfyuiService from '../services/comfyuiService.js';
import jobService from '../services/jobService.js';
import storageService from '../services/storageService.js';
import imageService from '../services/imageService.js';
import { SubmitJobResponse, JobStatusResponse, ErrorResponse } from '../types/index.js';

/**
 * POST /api/ai/submit
 * Receber imagem e submeter para processamento
 */
export const submitJob = asyncHandler(async (req: Request, res: Response) => {
  // 1. Validar arquivo (multer já validou, mas validar novamente)
  if (!req.file) {
    throw new ApiError(
      400,
      'NO_FILE',
      'Arquivo obrigatório. Use multipart/form-data com campo "image".'
    );
  }

  const { workflow = 'catalog' } = req.body;

  // Validar workflow type
  if (!['catalog', 'portrait', 'custom'].includes(workflow)) {
    throw new ApiError(
      400,
      'INVALID_WORKFLOW',
      `Workflow inválido: ${workflow}. Opcões: catalog, portrait, custom`
    );
  }

  try {
    // 2. Validar arquivo é imagem
    imageService.validateFile(
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
      config.uploadMaxSize
    );

    logger.debug(
      {
        filename: req.file.originalname,
        size: req.file.size,
        mime: req.file.mimetype,
      },
      'Arquivo validado'
    );

    // 3. Criar ID do job
    const jobId = `job_${uuidv4()}`;

    // 4. Salvar upload
    const uploadPath = await storageService.saveUpload(
      req.file.buffer,
      req.file.originalname,
      jobId
    );

    logger.info({ jobId, uploadPath }, 'Upload salvo');

    // 5. Criar job + enfileirar em BullMQ (async, não bloqueia)
    // ETAPA 10: Desacoplamento - job é criado em SQLite e enfileirado
    // O processamento em ComfyUI é feito por worker, não aqui
    await jobService.createJob(jobId, workflow, uploadPath, 'pending');

    logger.info(
      { jobId, promptId, workflow },
      'Job submetido ao ComfyUI com sucesso'
    );

    // 10. Retornar resposta 202
    const response: SubmitJobResponse = {
      status: 'queued',
      job_id: jobId,
      message: 'Imagem recebida. Processamento iniciado.',
      estimated_wait: '2-5 minutes',
      polling_url: `/api/ai/status/${jobId}`,
    };

    res.status(202).json(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.error({ error }, 'Erro ao processar submit');
    throw new ApiError(
      500,
      'PROCESSING_ERROR',
      'Erro ao processar imagem. Tente novamente.'
    );
  }
});

/**
 * GET /api/ai/status/:jobId
 * Verificar status do processamento
 */
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;

  if (!jobId || jobId.length < 10) {
    throw new ApiError(400, 'INVALID_JOB_ID', 'Job ID inválido ou muito curto');
  }

  // 1. Buscar job
  const job = jobService.getJob(jobId);

  if (!job) {
    throw new ApiError(
      404,
      'JOB_NOT_FOUND',
      'Job não encontrado ou expirou.'
    );
  }

  // 2. Se ainda está em fila, retornar posição
  if (job.status === 'queued') {
    const position = jobService.getQueuePosition(jobId);

    const response: JobStatusResponse = {
      job_id: jobId,
      status: 'queued',
      progress: 0,
      message: `Na fila. Posição: ${position}`,
      created_at: job.createdAt.toISOString(),
    };

    res.status(200).json(response);
    return;
  }

  // 3. Se está processando, fazer polling
  if (job.status === 'processing' && job.comfyuiPromptId) {
    try {
      const comfyStatus = await comfyuiService.getStatus(job.comfyuiPromptId);

      // Atualizar progresso
      jobService.updateProgress(jobId, comfyStatus.progress || 50);

      // Se completou, atualizar job
      if (comfyStatus.status === 'completed' && comfyStatus.result) {
        const imagePath = comfyuiService.extractImagePath(comfyStatus.result);

        if (imagePath) {
          jobService.completeJob(jobId, imagePath);

          const response: JobStatusResponse = {
            job_id: jobId,
            status: 'completed',
            progress: 100,
            message: 'Processamento concluído com sucesso!',
            created_at: job.createdAt.toISOString(),
            started_at: job.startedAt?.toISOString(),
            completed_at: new Date().toISOString(),
            result: {
              image_url: `/api/ai/result/${jobId}`,
              processing_time: this.formatDuration(
                new Date().getTime() - job.startedAt!.getTime()
              ),
            },
          };

          res.status(200).json(response);
          return;
        }
      }

      // Se falhou
      if (comfyStatus.status === 'failed') {
        jobService.failJob(jobId, 'Erro ao processar no ComfyUI');

        const response: JobStatusResponse = {
          job_id: jobId,
          status: 'failed',
          progress: 0,
          message: 'Processamento falhou',
          created_at: job.createdAt.toISOString(),
          started_at: job.startedAt?.toISOString(),
          completed_at: new Date().toISOString(),
        };

        res.status(200).json(response);
        return;
      }

      // Ainda processando
      const response: JobStatusResponse = {
        job_id: jobId,
        status: 'processing',
        progress: comfyStatus.progress || 50,
        message: `Processando... ${comfyStatus.progress || 50}% concluído`,
        created_at: job.createdAt.toISOString(),
        started_at: job.startedAt?.toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      logger.warn({ jobId, error }, 'Erro ao fazer polling');

      // Retornar status em cache
      const response: JobStatusResponse = {
        job_id: jobId,
        status: job.status,
        progress: job.progress,
        message: 'Processando...',
        created_at: job.createdAt.toISOString(),
      };

      res.status(200).json(response);
    }

    return;
  }

  // 4. Job já completo ou falhado
  const response: JobStatusResponse = {
    job_id: jobId,
    status: job.status,
    progress: job.progress,
    message:
      job.status === 'completed'
        ? 'Processamento concluído'
        : `Processamento ${job.status}`,
    created_at: job.createdAt.toISOString(),
    started_at: job.startedAt?.toISOString(),
    completed_at: job.completedAt?.toISOString(),
    result: job.status === 'completed'
      ? {
          image_url: `/api/ai/result/${jobId}`,
          processing_time: this.formatDuration(
            job.completedAt!.getTime() - job.startedAt!.getTime()
          ),
        }
      : undefined,
  };

  res.status(200).json(response);
});

/**
 * GET /api/ai/result/:jobId
 * Baixar imagem processada
 */
export const getResult = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;

  // 1. Buscar job
  const job = jobService.getJob(jobId);

  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job não encontrado');
  }

  // 2. Verificar status
  if (job.status !== 'completed') {
    res.status(202).json({
      status: 'not_ready',
      job_id: jobId,
      current_status: job.status,
      progress: job.progress,
      message: 'Resultado ainda não está pronto. Tente novamente em alguns segundos.',
      retry_after: 5,
    });
    return;
  }

  // 3. Verificar se tem output
  if (!job.outputImagePath) {
    throw new ApiError(
      410,
      'RESULT_LOST',
      'Resultado foi removido ou perdido'
    );
  }

  // 4. Ler arquivo
  const buffer = await storageService.readFile(job.outputImagePath);

  // 5. Enviar como imagem
  res.set('Content-Type', 'image/png');
  res.set('Content-Disposition', `attachment; filename="${jobId}_result.png"`);
  res.send(buffer);

  logger.info({ jobId }, 'Resultado enviado');
});

/**
 * DELETE /api/ai/job/:jobId
 * Cancelar job
 */
export const cancelJob = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;

  // 1. Buscar job
  const job = jobService.getJob(jobId);

  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job não encontrado');
  }

  // 2. Cancelar
  if (job.status === 'completed' || job.status === 'failed') {
    throw new ApiError(
      409,
      'CANNOT_CANCEL',
      `Job já está ${job.status}. Não pode ser cancelado.`
    );
  }

  jobService.cancelJob(jobId);

  // 3. Tentar cancelar no ComfyUI (opcional)
  // TODO: Implementar /interrupt no ComfyUI

  res.status(200).json({
    status: 'cancelled',
    job_id: jobId,
    message: 'Job cancelado com sucesso',
    previous_status: job.status,
    cancelled_at: new Date().toISOString(),
  });

  logger.info({ jobId }, 'Job cancelado');
});

/**
 * Utilitário: formatar duração em ms para string legível
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

// Exportar para reutilizar
export const AIController = {
  submitJob,
  getStatus,
  getResult,
  cancelJob,
};

export default AIController;
