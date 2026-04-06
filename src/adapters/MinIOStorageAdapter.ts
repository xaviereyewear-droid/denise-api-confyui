/**
 * MINIO STORAGE ADAPTER
 *
 * Implementação de storage usando MinIO (S3-compatible)
 * Permite armazenar objetos em bucket centralizado
 *
 * Paths armazenados são chaves do objeto S3
 * Exemplo: "uploads/job_abc123.jpg"
 *
 * MinIO roda em Docker container e é compatível com S3
 * Fácil migrar para AWS S3 apenas mudando credenciais
 */

import * as Minio from 'minio';
import logger from '../lib/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { StorageAdapter } from '../types/storage.js';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Implementação de StorageAdapter para MinIO/S3
 */
export class MinIOStorageAdapter implements StorageAdapter {
  private client: Minio.Client;
  private bucket: string;
  private uploadPrefix: string;
  private outputPrefix: string;
  private initialized: boolean = false;

  constructor(config: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    useSSL?: boolean;
    region?: string;
  }) {
    const { endpoint, accessKey, secretKey, bucket, useSSL = false, region = 'us-east-1' } = config;

    this.bucket = bucket;
    this.uploadPrefix = 'uploads/';
    this.outputPrefix = 'outputs/';

    // Inicializar cliente MinIO
    this.client = new Minio.Client({
      endPoint: endpoint,
      accessKey,
      secretKey,
      useSSL,
      region,
    });

    logger.info(
      { endpoint, bucket, useSSL },
      'MinIOStorageAdapter criado'
    );
  }

  /**
   * Inicializar adapter
   */
  async initialize(): Promise<void> {
    try {
      // Criar bucket se não existir
      const exists = await this.client.bucketExists(this.bucket);

      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        logger.info({ bucket: this.bucket }, 'Bucket criado');
      }

      this.initialized = true;
      logger.info({ bucket: this.bucket }, 'MinIOStorageAdapter inicializado');
    } catch (error) {
      logger.error({ error }, 'Erro ao inicializar MinIOStorageAdapter');
      throw error;
    }
  }

  /**
   * Salvar arquivo de upload
   */
  async saveUpload(
    buffer: Buffer,
    originalFilename: string,
    jobId: string
  ): Promise<string> {
    try {
      // Validar
      this.validateFile(originalFilename);

      // Gerar chave segura
      const ext = this.getExtension(originalFilename);
      const objectName = `${this.uploadPrefix}${jobId}${ext}`;

      // Fazer upload
      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        {
          'Content-Type': this.getMimeType(originalFilename),
          'x-amz-meta-job-id': jobId,
        }
      );

      logger.info(
        { jobId, objectName, size: buffer.length },
        'Upload salvo com sucesso no MinIO'
      );

      // Retornar object name (chave S3)
      return objectName;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ error, jobId }, 'Erro ao salvar upload em MinIO');
      throw new ApiError(500, 'STORAGE_ERROR', 'Erro ao armazenar arquivo');
    }
  }

  /**
   * Salvar resultado de processamento
   */
  async saveResult(
    buffer: Buffer,
    jobId: string,
    format: 'png' | 'jpg' | 'webp' = 'png'
  ): Promise<string> {
    try {
      const ext = `.${format}`;
      const objectName = `${this.outputPrefix}${jobId}_result${ext}`;

      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        {
          'Content-Type': `image/${format}`,
          'x-amz-meta-job-id': jobId,
        }
      );

      logger.info(
        { jobId, objectName, size: buffer.length },
        'Resultado salvo com sucesso no MinIO'
      );

      return objectName;
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao salvar resultado em MinIO');
      throw new ApiError(500, 'STORAGE_ERROR', 'Erro ao armazenar resultado');
    }
  }

  /**
   * Ler arquivo
   */
  async readFile(objectName: string): Promise<Buffer> {
    try {
      // Validar que objeto está no bucket correto
      this.validateObjectName(objectName);

      // Stream de leitura
      const dataStream = await this.client.getObject(this.bucket, objectName);

      // Converter stream para buffer
      const chunks: Buffer[] = [];
      for await (const chunk of dataStream) {
        chunks.push(chunk as Buffer);
      }

      const buffer = Buffer.concat(chunks);

      logger.debug({ objectName, size: buffer.length }, 'Arquivo lido do MinIO');

      return buffer;
    } catch (error) {
      logger.error({ objectName, error }, 'Erro ao ler arquivo do MinIO');
      throw new ApiError(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado');
    }
  }

  /**
   * Deletar arquivo
   */
  async deleteFile(objectName: string): Promise<void> {
    try {
      this.validateObjectName(objectName);

      await this.client.removeObject(this.bucket, objectName);

      logger.debug({ objectName }, 'Arquivo deletado do MinIO');
    } catch (error) {
      logger.warn({ objectName, error }, 'Erro ao deletar arquivo do MinIO');
      // Não throw - idempotente
    }
  }

  /**
   * Verificar se arquivo existe
   */
  async fileExists(objectName: string): Promise<boolean> {
    try {
      this.validateObjectName(objectName);

      // MinIO não tem método direto de stat, fazer HEAD request
      // Usar client.statObject (não disponível em todas as versões)
      // Alternativa: tentar ler
      const dataStream = await this.client.getObject(this.bucket, objectName);
      dataStream.destroy(); // Não precisa ler, só verificar existência
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obter tamanho de arquivo
   */
  async getFileSize(objectName: string): Promise<number> {
    try {
      this.validateObjectName(objectName);

      // Usar HEAD request para obter metadados (mais eficiente que GET)
      const stat = await (this.client as any).statObject(this.bucket, objectName);
      return stat.size || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Obter uso total de storage (estimado)
   */
  async getDiskUsage(): Promise<{
    uploads: number;
    outputs: number;
    total: number;
  }> {
    try {
      let uploadSize = 0;
      let outputSize = 0;

      // Listar objetos com prefixo "uploads/"
      const uploadObjects = this.client.listObjects(
        this.bucket,
        this.uploadPrefix,
        false
      );

      for await (const obj of uploadObjects) {
        if (obj.size) {
          uploadSize += obj.size;
        }
      }

      // Listar objetos com prefixo "outputs/"
      const outputObjects = this.client.listObjects(
        this.bucket,
        this.outputPrefix,
        false
      );

      for await (const obj of outputObjects) {
        if (obj.size) {
          outputSize += obj.size;
        }
      }

      return {
        uploads: uploadSize,
        outputs: outputSize,
        total: uploadSize + outputSize,
      };
    } catch (error) {
      logger.warn({ error }, 'Erro ao calcular uso de storage em MinIO');
      return { uploads: 0, outputs: 0, total: 0 };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Tentar listar buckets
      const buckets = await this.client.listBuckets();
      const exists = buckets.some((b) => b.name === this.bucket);
      return exists;
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
    const available = await this.healthCheck();
    const usage = available ? await this.getDiskUsage() : { total: 0 };

    return {
      type: 'minio',
      available,
      usedCapacity: usage.total,
    };
  }

  /**
   * Fechar conexões (se necessário)
   */
  async close?(): Promise<void> {
    // MinIO client não mantém conexão persistente
    // Apenas resetar flag
    this.initialized = false;
    logger.info('MinIOStorageAdapter fechado');
  }

  /**
   * Validar arquivo antes de salvar
   */
  private validateFile(filename: string): void {
    const ext = this.getExtension(filename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        'INVALID_FILE_TYPE',
        `Arquivo deve ser JPG, PNG ou WebP. Recebido: ${ext}`
      );
    }
  }

  /**
   * Extrair extensão do filename
   */
  private getExtension(filename: string): string {
    const match = filename.match(/\.[^/.]+$/);
    return match ? match[0] : '';
  }

  /**
   * Obter MIME type da extensão
   */
  private getMimeType(filename: string): string {
    const ext = this.getExtension(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * Validar object name (segurança)
   */
  private validateObjectName(objectName: string): void {
    // Não permitir path traversal
    if (objectName.includes('..') || objectName.startsWith('/')) {
      throw new Error('Invalid object name');
    }
  }
}

/**
 * Factory para criar instância
 */
export function createMinIOAdapter(config: {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL?: boolean;
  region?: string;
}): MinIOStorageAdapter {
  return new MinIOStorageAdapter(config);
}

export default MinIOStorageAdapter;
