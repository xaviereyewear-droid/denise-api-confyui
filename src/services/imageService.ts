/**
 * SERVIÇO DE PROCESSAMENTO DE IMAGEM
 *
 * Responsável por:
 * - Validar imagens
 * - Obter metadados
 * - Converter formatos
 */

import { ApiError } from '../middleware/errorHandler.js';
import logger from '../lib/logger.js';

/**
 * MIME types aceitos
 */
export const ACCEPTED_MIMES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

/**
 * Magic bytes (assinatura de arquivo)
 */
const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46],
};

/**
 * Serviço de Imagem
 */
class ImageService {
  /**
   * Validar se buffer é uma imagem válida
   *
   * @param buffer Conteúdo do arquivo
   * @param mimeType MIME type declarado
   * @returns true se válido
   */
  validateImageBuffer(buffer: Buffer, mimeType: string): boolean {
    try {
      // Verificar magic bytes
      const isValidFormat = this.checkMagicBytes(buffer, mimeType);

      if (!isValidFormat) {
        return false;
      }

      // Verificar tamanho mínimo (imagem válida é maior que 100 bytes)
      if (buffer.length < 100) {
        return false;
      }

      return true;
    } catch (error) {
      logger.warn({ error }, 'Erro ao validar imagem');
      return false;
    }
  }

  /**
   * Verificar magic bytes do arquivo
   */
  private checkMagicBytes(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 4) return false;

    const bytes = Array.from(buffer.slice(0, 4));

    switch (mimeType.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

      case 'image/png':
        return (
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47
        );

      case 'image/webp':
        // WEBP: RIFF....WEBP
        return (
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46
        );

      default:
        return false;
    }
  }

  /**
   * Obter dimensões da imagem (estimativa básica)
   *
   * NOTA: Implementação simplificada
   * Para produção, usar biblioteca como 'probe-image-size'
   */
  async getImageDimensions(
    buffer: Buffer,
    mimeType: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      // Implementação simplificada - detectar formato básico
      // Em produção, usar library especializada

      switch (mimeType.toLowerCase()) {
        case 'image/png':
          return this.getPNGDimensions(buffer);

        case 'image/jpeg':
        case 'image/jpg':
          return this.getJPEGDimensions(buffer);

        default:
          return null;
      }
    } catch (error) {
      logger.warn({ error }, 'Erro ao obter dimensões');
      return null;
    }
  }

  /**
   * Extrair dimensões de PNG
   */
  private getPNGDimensions(buffer: Buffer): { width: number; height: number } | null {
    try {
      // PNG: width está em bytes 16-20, height em 20-24
      if (buffer.length < 24) return null;

      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);

      return { width, height };
    } catch {
      return null;
    }
  }

  /**
   * Extrair dimensões de JPEG (simplificado)
   */
  private getJPEGDimensions(
    buffer: Buffer
  ): { width: number; height: number } | null {
    try {
      // JPEG parsing é complexo - retornar null para MVP
      // Em produção, usar library como 'probe-image-size'
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validar arquivo antes de salvar
   *
   * @param filename Nome do arquivo
   * @param mimeType MIME type
   * @param buffer Conteúdo
   * @param maxSize Tamanho máximo em bytes
   * @throws ApiError se inválido
   */
  validateFile(
    filename: string,
    mimeType: string,
    buffer: Buffer,
    maxSize: number
  ): void {
    // Validar MIME type
    if (!Object.keys(ACCEPTED_MIMES).includes(mimeType.toLowerCase())) {
      throw new ApiError(
        400,
        'INVALID_MIME_TYPE',
        `MIME type não aceito: ${mimeType}. Aceitos: ${Object.keys(ACCEPTED_MIMES).join(', ')}`
      );
    }

    // Validar tamanho
    if (buffer.length > maxSize) {
      const maxMB = (maxSize / 1024 / 1024).toFixed(1);
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);

      throw new ApiError(
        413,
        'FILE_TOO_LARGE',
        `Arquivo muito grande. Máximo: ${maxMB}MB. Recebido: ${sizeMB}MB`,
        {
          max_size: maxSize,
          received_size: buffer.length,
        }
      );
    }

    // Validar magic bytes
    if (!this.validateImageBuffer(buffer, mimeType)) {
      throw new ApiError(
        400,
        'INVALID_IMAGE',
        'Arquivo não é uma imagem válida. Pode estar corrompido.'
      );
    }
  }

  /**
   * Obter extensão do arquivo
   */
  getExtensionFromMime(mimeType: string): string {
    const extensions = ACCEPTED_MIMES[mimeType.toLowerCase() as keyof typeof ACCEPTED_MIMES];
    return extensions ? extensions[0] : 'bin';
  }

  /**
   * Formatar bytes para string legível
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (Math.round(bytes / Math.pow(k, i) * 100) / 100) + ' ' + sizes[i];
  }
}

export const imageService = new ImageService();

export default imageService;
