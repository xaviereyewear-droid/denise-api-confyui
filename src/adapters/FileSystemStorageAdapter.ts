/**
 * FILESYSTEM STORAGE ADAPTER
 *
 * Implementação de storage usando filesystem local
 * Mantém compatibilidade com código existente
 *
 * Paths armazenados são relativos ao basePath
 * Exemplo: "uploads/job_abc123.jpg"
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import logger from '../lib/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { StorageAdapter } from '../types/storage.js';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Implementação de StorageAdapter para FileSystem local
 */
export class FileSystemStorageAdapter implements StorageAdapter {
  private basePath: string;
  private uploadDir: string;
  private outputDir: string;
  private tempDir: string;

  constructor(basePath: string = './storage') {
    this.basePath = resolve(basePath);
    this.uploadDir = join(this.basePath, 'uploads');
    this.outputDir = join(this.basePath, 'outputs');
    this.tempDir = join(this.basePath, 'temp');
  }

  /**
   * Inicializar adapter
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDirectories();
      logger.info(
        { basePath: this.basePath },
        'FileSystemStorageAdapter inicializado'
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao inicializar FileSystemStorageAdapter');
      throw error;
    }
  }

  /**
   * Garantir que diretórios existem
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [this.basePath, this.uploadDir, this.outputDir, this.tempDir];

    for (const dir of dirs) {
      try {
        if (!existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true });
          logger.debug({ dir }, 'Diretório criado');
        }
      } catch (error) {
        logger.error({ dir, error }, 'Erro ao criar diretório');
        throw error;
      }
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

      // Gerar nome seguro
      const ext = this.getExtension(originalFilename);
      const filename = `${jobId}${ext}`;
      const filepath = join(this.uploadDir, filename);

      // Salvar
      await fs.writeFile(filepath, buffer);

      logger.info(
        { jobId, filename, size: buffer.length },
        'Upload salvo com sucesso'
      );

      // Retornar path relativo
      return this.makeRelativePath(filepath);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ error, jobId }, 'Erro ao salvar upload');
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
      const filename = `${jobId}_result${ext}`;
      const filepath = join(this.outputDir, filename);

      await fs.writeFile(filepath, buffer);

      logger.info(
        { jobId, filename, size: buffer.length },
        'Resultado salvo com sucesso'
      );

      // Retornar path relativo
      return this.makeRelativePath(filepath);
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao salvar resultado');
      throw new ApiError(500, 'STORAGE_ERROR', 'Erro ao armazenar resultado');
    }
  }

  /**
   * Ler arquivo
   */
  async readFile(path: string): Promise<Buffer> {
    try {
      // Converter para absolute path se necessário
      const absolutePath = this.resolveAbsolutePath(path);

      // Validação de segurança
      this.validatePath(absolutePath);

      const buffer = await fs.readFile(absolutePath);

      logger.debug({ path }, 'Arquivo lido');

      return buffer;
    } catch (error) {
      logger.error({ path, error }, 'Erro ao ler arquivo');
      throw new ApiError(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado');
    }
  }

  /**
   * Deletar arquivo
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const absolutePath = this.resolveAbsolutePath(path);

      this.validatePath(absolutePath);

      await fs.unlink(absolutePath);

      logger.debug({ path }, 'Arquivo deletado');
    } catch (error) {
      logger.warn({ path, error }, 'Erro ao deletar arquivo');
      // Não throw - arquivo pode já estar deletado (idempotente)
    }
  }

  /**
   * Verificar se arquivo existe
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const absolutePath = this.resolveAbsolutePath(path);
      this.validatePath(absolutePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obter tamanho de arquivo
   */
  async getFileSize(path: string): Promise<number> {
    try {
      const absolutePath = this.resolveAbsolutePath(path);
      const stats = await fs.stat(absolutePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Obter uso total de storage
   */
  async getDiskUsage(): Promise<{
    uploads: number;
    outputs: number;
    total: number;
  }> {
    try {
      const [uploadSize, outputSize] = await Promise.all([
        this.getDirSize(this.uploadDir),
        this.getDirSize(this.outputDir),
      ]);

      return {
        uploads: uploadSize,
        outputs: outputSize,
        total: uploadSize + outputSize,
      };
    } catch (error) {
      logger.warn(
        { err: error },
        'Erro ao calcular uso de disco'
      );
      // Retornar 0 como fallback - diretórios podem estar inacessíveis
      return { uploads: 0, outputs: 0, total: 0 };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.basePath);
      return true;
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
      type: 'filesystem',
      available,
      usedCapacity: usage.total,
    };
  }

  /**
   * Calcular tamanho recursivo de diretório
   */
  private async getDirSize(dirpath: string): Promise<number> {
    let totalSize = 0;

    try {
      // Check se diretório existe
      if (!existsSync(dirpath)) {
        logger.debug({ dir: dirpath }, 'Diretório não existe, usando 0');
        return 0;
      }

      // Ler diretório com tratamento de erro
      let files: string[] = [];
      try {
        files = await fs.readdir(dirpath);
      } catch (error) {
        logger.warn(
          { dir: dirpath, err: error },
          'Erro ao ler diretório'
        );
        return 0;
      }

      // Calcular tamanho de cada arquivo/subdiretório
      for (const file of files) {
        try {
          const filepath = join(dirpath, file);
          const stats = await fs.stat(filepath);

          if (stats.isDirectory()) {
            totalSize += await this.getDirSize(filepath);
          } else {
            totalSize += stats.size;
          }
        } catch (error) {
          // Log mas não falha - arquivo pode ter sido deletado durante iteração
          logger.debug(
            { file, err: error },
            'Erro ao processar arquivo em getDirSize'
          );
        }
      }
    } catch (error) {
      logger.error(
        { dir: dirpath, err: error },
        'Erro inesperado em getDirSize'
      );
      return 0;
    }

    return totalSize;
  }

  /**
   * Validar arquivo antes de salvar
   */
  private validateFile(filename: string): void {
    // Validar extension
    const ext = this.getExtension(filename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        'INVALID_FILE_TYPE',
        `Arquivo deve ser JPG, PNG ou WebP. Recebido: ${ext}`
      );
    }

    // TODO: Adicionar validação de tamanho máximo
    // Se necessário, pode vir de config global
  }

  /**
   * Extrair extensão do filename
   */
  private getExtension(filename: string): string {
    const match = filename.match(/\.[^/.]+$/);
    return match ? match[0] : '';
  }

  /**
   * Converter path para relative (para armazenar em DB)
   */
  private makeRelativePath(absolutePath: string): string {
    return relative(this.basePath, absolutePath);
  }

  /**
   * Resolver path para absoluto (para operações de I/O)
   */
  private resolveAbsolutePath(path: string): string {
    if (path.startsWith(this.basePath)) {
      return path;
    }
    return join(this.basePath, path);
  }

  /**
   * Validar path (segurança contra path traversal)
   */
  private validatePath(absolutePath: string): void {
    const normalized = resolve(absolutePath);

    // Garantir que está dentro de basePath
    if (!normalized.startsWith(this.basePath)) {
      throw new Error('Path traversal attempt detected');
    }
  }
}

/**
 * Factory para criar instância
 */
export function createFileSystemAdapter(basePath?: string): FileSystemStorageAdapter {
  return new FileSystemStorageAdapter(basePath);
}

export default FileSystemStorageAdapter;
