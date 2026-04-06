/**
 * SERVIÇO DE ARMAZENAMENTO (REFATORADO)
 *
 * Orquestra adapters de storage (FileSystem, MinIO, S3)
 * Permite trocar backends sem modificar código cliente
 *
 * Configurado via variáveis de ambiente:
 * - STORAGE_TYPE=filesystem|minio|s3 (padrão: filesystem)
 * - STORAGE_MINIO_ENDPOINT=localhost:9000
 * - STORAGE_MINIO_ACCESS_KEY=minioadmin
 * - STORAGE_MINIO_SECRET_KEY=minioadmin
 * - STORAGE_MINIO_BUCKET=comfyui
 * - STORAGE_MINIO_SSL=false
 */

import config from '../config/env.js';
import logger from '../lib/logger.js';
import { StorageAdapter } from '../types/storage.js';
import { FileSystemStorageAdapter } from '../adapters/FileSystemStorageAdapter.js';
import { MinIOStorageAdapter } from '../adapters/MinIOStorageAdapter.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Serviço de Storage com abstração
 */
class StorageService {
  private adapter: StorageAdapter | null = null;
  private adapterType: string = 'unknown';

  /**
   * Inicializar storage com adapter configurado
   */
  async initialize(): Promise<void> {
    try {
      const storageType = (process.env.STORAGE_TYPE || 'filesystem').toLowerCase();

      logger.info({ storageType }, 'Inicializando Storage Service');

      switch (storageType) {
        case 'minio':
          this.adapter = new MinIOStorageAdapter({
            endpoint: process.env.STORAGE_MINIO_ENDPOINT || 'localhost:9000',
            accessKey: process.env.STORAGE_MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.STORAGE_MINIO_SECRET_KEY || 'minioadmin',
            bucket: process.env.STORAGE_MINIO_BUCKET || 'comfyui',
            useSSL: process.env.STORAGE_MINIO_SSL === 'true',
            region: process.env.STORAGE_MINIO_REGION || 'us-east-1',
          });
          this.adapterType = 'minio';
          break;

        case 's3':
          // Futura implementação
          throw new Error('S3 adapter ainda não implementado');

        case 'filesystem':
        default:
          this.adapter = new FileSystemStorageAdapter(
            process.env.STORAGE_PATH || './storage'
          );
          this.adapterType = 'filesystem';
      }

      // Inicializar adapter
      await this.adapter.initialize();

      logger.info(
        { adapterType: this.adapterType },
        '✅ Storage Service inicializado com sucesso'
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao inicializar Storage Service');
      throw error;
    }
  }

  /**
   * Garantir que adapter está inicializado
   */
  private ensureInitialized(): StorageAdapter {
    if (!this.adapter) {
      throw new Error('Storage Service não foi inicializado');
    }
    return this.adapter;
  }

  /**
   * Salvar arquivo de upload
   */
  async saveUpload(
    buffer: Buffer,
    originalFilename: string,
    jobId: string
  ): Promise<string> {
    const adapter = this.ensureInitialized();
    return adapter.saveUpload(buffer, originalFilename, jobId);
  }

  /**
   * Salvar resultado de processamento
   */
  async saveResult(
    buffer: Buffer,
    jobId: string,
    format: 'png' | 'jpg' | 'webp' = 'png'
  ): Promise<string> {
    const adapter = this.ensureInitialized();
    return adapter.saveResult(buffer, jobId, format);
  }

  /**
   * Ler arquivo
   */
  async readFile(path: string): Promise<Buffer> {
    const adapter = this.ensureInitialized();
    return adapter.readFile(path);
  }

  /**
   * Deletar arquivo
   */
  async deleteFile(path: string): Promise<void> {
    const adapter = this.ensureInitialized();
    return adapter.deleteFile(path);
  }

  /**
   * Verificar se arquivo existe
   */
  async fileExists(path: string): Promise<boolean> {
    const adapter = this.ensureInitialized();
    return adapter.fileExists(path);
  }

  /**
   * Obter tamanho de arquivo
   */
  async getFileSize(path: string): Promise<number> {
    const adapter = this.ensureInitialized();
    return adapter.getFileSize(path);
  }

  /**
   * Obter uso de storage
   */
  async getDiskUsage(): Promise<{
    uploads: number;
    outputs: number;
    total: number;
  }> {
    const adapter = this.ensureInitialized();
    return adapter.getDiskUsage();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const adapter = this.ensureInitialized();
      return adapter.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Obter informações do storage
   */
  async getInfo(): Promise<{
    type: string;
    available: boolean;
    totalCapacity?: number;
    usedCapacity?: number;
  }> {
    const adapter = this.ensureInitialized();
    return adapter.getInfo();
  }

  /**
   * Obter tipo de adapter atual
   */
  getAdapterType(): string {
    return this.adapterType;
  }

  /**
   * Fechar storage
   */
  async close(): Promise<void> {
    if (this.adapter && this.adapter.close) {
      await this.adapter.close();
    }
  }
}

// Instância singleton
export const storageService = new StorageService();

export default storageService;
