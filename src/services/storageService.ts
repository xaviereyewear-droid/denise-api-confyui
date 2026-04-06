/**
 * SERVIÇO DE ARMAZENAMENTO DE ARQUIVOS
 *
 * Responsável por:
 * - Salvar uploads de imagens
 * - Organizando por pastas
 * - Validação de arquivos
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import config from '../config/env.js';
import logger from '../lib/logger.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Tipos MIME aceitos
 */
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Serviço de Storage
 */
class StorageService {
  private basePath: string;
  private uploadDir: string;
  private outputDir: string;
  private tempDir: string;

  constructor() {
    this.basePath = config.storagePath;
    this.uploadDir = join(this.basePath, 'uploads');
    this.outputDir = join(this.basePath, 'outputs');
    this.tempDir = join(this.basePath, 'temp');

    this.ensureDirectories();
  }

  /**
   * Garantir que diretórios existem
   */
  private ensureDirectories(): void {
    const dirs = [this.basePath, this.uploadDir, this.outputDir, this.tempDir];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        try {
          // Criar recursivamente
          fs.mkdirSync(dir, { recursive: true });
          logger.info({ dir }, 'Diretório criado');
        } catch (error) {
          logger.error({ dir, error }, 'Erro ao criar diretório');
        }
      }
    }
  }

  /**
   * Salvar arquivo de upload
   *
   * @param buffer Conteúdo do arquivo
   * @param originalFilename Nome original
   * @param jobId ID do job (para organizar)
   * @returns Caminho absoluto do arquivo salvo
   */
  async saveUpload(
    buffer: Buffer,
    originalFilename: string,
    jobId: string
  ): Promise<string> {
    try {
      // Validar
      this.validateFile(originalFilename, buffer);

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

      return filepath;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ error, jobId }, 'Erro ao salvar upload');
      throw new ApiError(500, 'STORAGE_ERROR', 'Erro ao armazenar arquivo');
    }
  }

  /**
   * Salvar imagem de resultado
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

      return filepath;
    } catch (error) {
      logger.error({ error, jobId }, 'Erro ao salvar resultado');
      throw new ApiError(500, 'STORAGE_ERROR', 'Erro ao armazenar resultado');
    }
  }

  /**
   * Ler arquivo
   */
  async readFile(filepath: string): Promise<Buffer> {
    try {
      // Validação de segurança - não permitir path traversal
      const normalized = await this.validatePath(filepath);

      const buffer = await fs.readFile(normalized);

      logger.debug({ filepath }, 'Arquivo lido');

      return buffer;
    } catch (error) {
      logger.error({ filepath, error }, 'Erro ao ler arquivo');
      throw new ApiError(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado');
    }
  }

  /**
   * Deletar arquivo
   */
  async deleteFile(filepath: string): Promise<void> {
    try {
      const normalized = await this.validatePath(filepath);

      await fs.unlink(normalized);

      logger.debug({ filepath }, 'Arquivo deletado');
    } catch (error) {
      logger.warn({ filepath, error }, 'Erro ao deletar arquivo');
      // Não throw - arquivo pode já estar deletado
    }
  }

  /**
   * Validar caminho (segurança contra path traversal)
   */
  private async validatePath(filepath: string): Promise<string> {
    const absolutePath = join(filepath);

    // Garantir que está dentro de storage/
    if (!absolutePath.startsWith(this.basePath)) {
      throw new Error('Path traversal attempt detected');
    }

    // Verificar existência
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error('File not found');
    }

    return absolutePath;
  }

  /**
   * Validar arquivo antes de salvar
   */
  private validateFile(filename: string, buffer: Buffer): void {
    // Validar extension
    const ext = this.getExtension(filename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        'INVALID_FILE_TYPE',
        `Arquivo deve ser JPG, PNG ou WebP. Recebido: ${ext}`
      );
    }

    // Validar tamanho
    if (buffer.length > config.uploadMaxSize) {
      throw new ApiError(
        413,
        'FILE_TOO_LARGE',
        `Arquivo muito grande. Máximo: ${this.formatBytes(config.uploadMaxSize)}. Recebido: ${this.formatBytes(buffer.length)}`,
        {
          max_size: config.uploadMaxSize,
          received_size: buffer.length,
        }
      );
    }

    // TODO: Validar magic bytes (JPEG, PNG signatures)
  }

  /**
   * Extrair extension do filename
   */
  private getExtension(filename: string): string {
    const match = filename.match(/\.[^/.]+$/);
    return match ? match[0] : '';
  }

  /**
   * Formatar bytes para string legível
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Obter tamanho de arquivo
   */
  async getFileSize(filepath: string): Promise<number> {
    try {
      const stats = await fs.stat(filepath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Obter espaço em disco usado
   */
  async getDiskUsage(): Promise<{
    uploads: number;
    outputs: number;
    total: number;
  }> {
    try {
      const uploadSize = await this.getDirSize(this.uploadDir);
      const outputSize = await this.getDirSize(this.outputDir);

      return {
        uploads: uploadSize,
        outputs: outputSize,
        total: uploadSize + outputSize,
      };
    } catch (error) {
      logger.warn({ error }, 'Erro ao calcular uso de disco');
      return { uploads: 0, outputs: 0, total: 0 };
    }
  }

  /**
   * Calcular tamanho recursivo de diretório
   */
  private async getDirSize(dirpath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(dirpath);

      for (const file of files) {
        const filepath = join(dirpath, file);
        const stats = await fs.stat(filepath);

        if (stats.isDirectory()) {
          totalSize += await this.getDirSize(filepath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch {
      // Diretório pode não existir
    }

    return totalSize;
  }
}

// Instância única
export const storageService = new StorageService();

export default storageService;
