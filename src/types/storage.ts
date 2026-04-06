/**
 * TIPOS E INTERFACES DE STORAGE
 *
 * Define o contrato para implementações de storage
 * Permite trocar de FileSystem → MinIO → S3 sem modificar código principal
 */

/**
 * Operação de arquivo
 * Usada para rastreabilidade
 */
export interface FileOperation {
  path: string;
  action: 'upload' | 'download' | 'delete';
  timestamp: Date;
  sizeBytes?: number;
  jobId?: string;
}

/**
 * Informação de arquivo
 */
export interface FileInfo {
  path: string;
  name: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Interface base para adapters de storage
 *
 * Qualquer implementação (FileSystem, MinIO, S3) deve respeitar este contrato
 */
export interface StorageAdapter {
  /**
   * Inicializar adapter (conexão, diretórios, etc)
   */
  initialize(): Promise<void>;

  /**
   * Salvar arquivo de upload
   * Retorna path relativo para referência posterior
   */
  saveUpload(
    buffer: Buffer,
    originalFilename: string,
    jobId: string
  ): Promise<string>;

  /**
   * Salvar resultado de processamento
   */
  saveResult(
    buffer: Buffer,
    jobId: string,
    format: 'png' | 'jpg' | 'webp'
  ): Promise<string>;

  /**
   * Ler arquivo
   * Path pode ser relativo ou absoluto dependendo da implementação
   */
  readFile(path: string): Promise<Buffer>;

  /**
   * Deletar arquivo
   * Deve ser idempotente (não erro se não existir)
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Verificar se arquivo existe
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Obter tamanho de arquivo
   * Retorna 0 se arquivo não existe
   */
  getFileSize(path: string): Promise<number>;

  /**
   * Obter uso total de storage
   * Separa uploads vs outputs
   */
  getDiskUsage(): Promise<{
    uploads: number;
    outputs: number;
    total: number;
  }>;

  /**
   * Health check do storage
   * Retorna true se storage está acessível
   */
  healthCheck(): Promise<boolean>;

  /**
   * Obter informações do storage
   * Útil para monitoramento
   */
  getInfo(): Promise<{
    type: string; // 'filesystem' | 'minio' | 's3'
    available: boolean;
    totalCapacity?: number;
    usedCapacity?: number;
  }>;

  /**
   * Fechar conexões (se necessário)
   */
  close?(): Promise<void>;
}

/**
 * Configuração base para storage
 */
export interface StorageConfig {
  type: 'filesystem' | 'minio' | 's3';
  basePath?: string; // Para FileSystem

  // MinIO config
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  useSSL?: boolean;
  region?: string;
}

/**
 * Resultado de operação de storage
 */
export interface StorageResult {
  success: boolean;
  path?: string;
  error?: string;
  sizeBytes?: number;
}
