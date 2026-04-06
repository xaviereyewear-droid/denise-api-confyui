/**
 * JOB MODEL
 *
 * Entidade Job com tipos TypeScript completos.
 * Funciona como interface entre banco de dados e aplicação.
 */

/**
 * Status possíveis de um job
 */
export type JobStatus =
  | 'pending'     // Criado, aguardando fila
  | 'queued'      // Na fila do ComfyUI
  | 'processing'  // Processando no ComfyUI
  | 'completed'   // Sucesso
  | 'failed'      // Erro durante processamento
  | 'cancelled';  // Cancelado pelo usuário

/**
 * Tipos de workflow suportados
 */
export type WorkflowType = 'catalog' | 'portrait' | 'custom';

/**
 * Job entity - representa um processamento
 */
export interface Job {
  // Identificação
  id: string;                    // job_<uuid>

  // Configuração
  workflow: WorkflowType;        // Tipo de workflow
  status: JobStatus;             // Status atual

  // Arquivos
  inputImagePath: string;        // Caminho da imagem enviada
  outputImagePath: string | null; // Caminho da imagem processada

  // ComfyUI Integration
  comfyuiPromptId: string | null; // ID do prompt no ComfyUI

  // Progress
  progress: number;              // 0-100

  // Timestamps
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;

  // Error handling
  errorMessage: string | null;

  // Metadata (extensível para futuro)
  metadata: Record<string, any> | null;
}

/**
 * Job para criação (sem timestamps/IDs gerados)
 */
export interface CreateJobInput {
  workflow: WorkflowType;
  inputImagePath: string;
}

/**
 * Job para atualização (partial update)
 */
export interface UpdateJobInput {
  status?: JobStatus;
  progress?: number;
  comfyuiPromptId?: string | null;
  outputImagePath?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  errorMessage?: string | null;
}

/**
 * Job como armazenado no banco de dados
 * (timestamps como strings ISO)
 */
export interface JobRow {
  id: string;
  workflow: WorkflowType;
  status: JobStatus;
  input_image_path: string;
  output_image_path: string | null;
  comfyui_prompt_id: string | null;
  progress: number;
  created_at: string;  // ISO datetime string
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: string | null;  // JSON stringified
}

/**
 * Converter Job (interno) para JobRow (banco)
 */
export function jobToRow(job: Job): Omit<JobRow, 'id'> {
  return {
    workflow: job.workflow,
    status: job.status,
    input_image_path: job.inputImagePath,
    output_image_path: job.outputImagePath,
    comfyui_prompt_id: job.comfyuiPromptId,
    progress: job.progress,
    created_at: job.createdAt.toISOString(),
    started_at: job.startedAt?.toISOString() || null,
    completed_at: job.completedAt?.toISOString() || null,
    error_message: job.errorMessage,
    metadata: job.metadata ? JSON.stringify(job.metadata) : null,
  };
}

/**
 * Converter JobRow (banco) para Job (interno)
 */
export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    workflow: row.workflow,
    status: row.status,
    inputImagePath: row.input_image_path,
    outputImagePath: row.output_image_path,
    comfyuiPromptId: row.comfyui_prompt_id,
    progress: row.progress,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    errorMessage: row.error_message,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

/**
 * Factory: Criar novo Job
 */
export function createNewJob(
  id: string,
  input: CreateJobInput
): Job {
  return {
    id,
    workflow: input.workflow,
    status: 'pending',
    inputImagePath: input.inputImagePath,
    outputImagePath: null,
    comfyuiPromptId: null,
    progress: 0,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    metadata: null,
  };
}

/**
 * Helper: Job completo?
 */
export function isJobTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Helper: Job pode ser cancelado?
 */
export function canCancelJob(status: JobStatus): boolean {
  return !isJobTerminal(status);
}

/**
 * Helper: Job pode ser retomado após restart?
 */
export function canRecoverJob(status: JobStatus): boolean {
  return status === 'pending' || status === 'queued' || status === 'processing';
}

export default Job;
