/**
 * TIPOS ESPECÍFICOS DO COMFYUI
 */

/**
 * Workflow do ComfyUI
 * Estrutura JSON que descreve o pipeline de processamento
 */
export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUINode;
}

/**
 * Um nó individual no workflow
 */
export interface ComfyUINode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title: string;
  };
}

/**
 * Resposta ao submeter um prompt
 */
export interface ComfyUIPromptResponse {
  prompt_id: string;
  number?: number;
}

/**
 * Execução em andamento
 */
export interface ComfyUIExecution {
  value: {
    prompt: unknown[];
    outputs: Record<string, unknown>;
  };
}

/**
 * Histórico de uma execução
 */
export interface ComfyUIHistory {
  [promptId: string]: {
    prompt: unknown[];
    outputs: Record<string, unknown>;
    status: {
      status_str: 'success' | 'error';
      completed: boolean;
      messages: string[];
    };
  };
}

/**
 * Status da fila
 */
export interface ComfyUIQueueStatus {
  queue_pending: unknown[][];
  queue_running: unknown[][];
}

/**
 * Resultado processado
 */
export interface ComfyUIResult {
  promptId: string;
  success: boolean;
  outputs?: Record<string, unknown>;
  error?: string;
  outputFiles?: string[];
}

/**
 * Tipos de workflow suportados
 */
export type WorkflowTemplate = 'catalog' | 'portrait' | 'custom';

/**
 * Configuração para criar um workflow específico
 */
export interface WorkflowConfig {
  type: WorkflowTemplate;
  inputImagePath: string;
  options?: {
    quality?: 'low' | 'medium' | 'high';
    format?: 'png' | 'jpg' | 'webp';
  };
}
