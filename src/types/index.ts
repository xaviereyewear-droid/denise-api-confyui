/**
 * TIPOS GLOBAIS DA APLICAÇÃO
 */

export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type WorkflowType = 'catalog' | 'portrait' | 'custom';

export interface Job {
  id: string;
  status: JobStatus;
  workflowType: WorkflowType;
  inputImagePath: string;
  outputImagePath?: string;
  comfyuiPromptId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  progress: number;
  estimatedTime?: number;
}

export interface SubmitJobRequest {
  workflow: WorkflowType;
  options?: {
    quality?: 'low' | 'medium' | 'high';
    format?: 'png' | 'jpg' | 'webp';
  };
}

export interface SubmitJobResponse {
  status: 'queued';
  job_id: string;
  message: string;
  estimated_wait: string;
  polling_url: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: {
    image_url: string;
    processing_time: string;
  };
}

export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    api: 'running' | 'stopped';
    comfyui: 'connected' | 'disconnected';
    storage: 'accessible' | 'inaccessible';
  };
}

export interface ComfyUIConfig {
  host: string;
  port: number;
  timeout: number;
}

export interface ApiConfig {
  port: number;
  host: string;
  env: 'development' | 'production';
  apiKey: string;
}
