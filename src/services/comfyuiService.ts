/**
 * SERVIÇO DE INTEGRAÇÃO COM COMFYUI
 *
 * Responsável por:
 * - Enviar workflows ao ComfyUI
 * - Fazer polling do status
 * - Recuperar resultados
 * - Tratamento de erros
 */

import axios, { AxiosInstance } from 'axios';
import config from '../config/env.js';
import logger from '../lib/logger.js';
import {
  ComfyUIWorkflow,
  ComfyUIPromptResponse,
  ComfyUIHistory,
  ComfyUIResult,
  WorkflowConfig,
} from '../types/comfyui.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Cliente HTTP para ComfyUI
 */
class ComfyUIService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.comfyui.baseUrl;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.comfyui.timeout,
      validateStatus: () => true, // Não throw em erro HTTP
    });

    logger.info({ url: this.baseUrl }, 'ComfyUI service inicializado');
  }

  /**
   * Verificar conectividade com ComfyUI
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/system_stats', {
        timeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      logger.warn('ComfyUI healthcheck falhou');
      return false;
    }
  }

  /**
   * Enviar workflow ao ComfyUI
   *
   * @param workflow Workflow JSON do ComfyUI
   * @returns Promise<string> ID do prompt
   */
  async submitWorkflow(workflow: ComfyUIWorkflow): Promise<string> {
    try {
      logger.debug({ nodeCount: Object.keys(workflow).length }, 'Enviando workflow ao ComfyUI');

      const response = await this.client.post<ComfyUIPromptResponse>('/prompt', workflow);

      if (response.status !== 200) {
        throw new ApiError(
          500,
          'COMFYUI_SUBMIT_ERROR',
          'Erro ao submeter workflow ao ComfyUI',
          {
            statusCode: response.status,
            message: response.data,
          }
        );
      }

      const promptId = response.data.prompt_id;

      if (!promptId) {
        throw new ApiError(
          500,
          'COMFYUI_NO_PROMPT_ID',
          'ComfyUI não retornou ID do prompt'
        );
      }

      logger.info({ promptId }, 'Workflow submetido com sucesso ao ComfyUI');

      return promptId;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ error }, 'Erro ao submeter workflow');
      throw new ApiError(
        503,
        'COMFYUI_CONNECTION_ERROR',
        'Erro ao conectar com ComfyUI. Verifique se está rodando.'
      );
    }
  }

  /**
   * Buscar histórico de execução (resultado final)
   *
   * @param promptId ID do prompt
   * @returns Histórico ou null se não encontrado
   */
  async getHistory(promptId: string): Promise<ComfyUIHistory[string] | null> {
    try {
      const response = await this.client.get<ComfyUIHistory>('/history');

      if (response.status !== 200) {
        logger.warn({ promptId, status: response.status }, 'Erro ao buscar histórico');
        return null;
      }

      const history = response.data;

      if (!history[promptId]) {
        logger.debug({ promptId }, 'Execução não encontrada no histórico');
        return null;
      }

      return history[promptId];
    } catch (error) {
      logger.error({ error, promptId }, 'Erro ao buscar histórico');
      return null;
    }
  }

  /**
   * Buscar status de execução (polling)
   *
   * @param promptId ID do prompt
   * @returns Status da execução
   */
  async getStatus(promptId: string): Promise<{
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: ComfyUIHistory[string];
  }> {
    try {
      // Tentar buscar no histórico (significa que completou)
      const history = await this.getHistory(promptId);

      if (history) {
        const isSuccess = history.status.status_str === 'success';

        return {
          status: isSuccess ? 'completed' : 'failed',
          result: history,
        };
      }

      // Se não está no histórico, ainda está processando
      // TODO: Implementar polling via WebSocket para progresso mais preciso
      return {
        status: 'processing',
        progress: 50, // Placeholder
      };
    } catch (error) {
      logger.error({ error, promptId }, 'Erro ao buscar status');
      return {
        status: 'failed',
      };
    }
  }

  /**
   * Extrair caminho da imagem do resultado
   *
   * @param result Resultado do ComfyUI
   * @returns Caminho relativo da imagem ou null
   */
  extractImagePath(result: ComfyUIHistory[string]): string | null {
    try {
      const outputs = result.outputs;

      if (!outputs) return null;

      // ComfyUI salva imagens em diferentes nós
      // Procurar pelo padrão típico
      for (const [_nodeId, output] of Object.entries(outputs)) {
        if (Array.isArray(output) && typeof output[0] === 'string') {
          // Array de strings geralmente é lista de imagens
          return output[0] as string;
        }

        if (
          typeof output === 'object' &&
          output !== null &&
          'images' in output &&
          Array.isArray((output as Record<string, unknown>).images)
        ) {
          const images = (output as Record<string, unknown>).images as string[];
          if (images.length > 0) {
            return images[0];
          }
        }
      }

      return null;
    } catch (error) {
      logger.warn({ error }, 'Erro ao extrair caminho da imagem');
      return null;
    }
  }

  /**
   * Criar um workflow de exemplo (Catalog - remover fundo)
   *
   * Este é um exemplo simplificado. O workflow real seria mais complexo.
   *
   * @param inputImagePath Caminho absoluto da imagem
   * @returns Workflow do ComfyUI
   */
  createCatalogWorkflow(inputImagePath: string): ComfyUIWorkflow {
    // Este é um exemplo estrutural
    // O workflow real depende dos modelos que você tem instalado no ComfyUI

    return {
      // Nó 1: Carregar imagem
      1: {
        class_type: 'LoadImage',
        inputs: {
          image: inputImagePath,
        },
        _meta: {
          title: 'Load Image',
        },
      },

      // Nó 2: Remover fundo (se tiver modelo RMBG)
      2: {
        class_type: 'RemoveBackground',
        inputs: {
          image: [1, 0],
        },
        _meta: {
          title: 'Remove Background',
        },
      },

      // Nó 3: Salvar imagem
      3: {
        class_type: 'SaveImage',
        inputs: {
          images: [2, 0],
          filename_prefix: 'catalog_output',
        },
        _meta: {
          title: 'Save Image',
        },
      },
    };
  }

  /**
   * Criar um workflow para retoque de portrait
   *
   * @param inputImagePath Caminho absoluto da imagem
   * @returns Workflow do ComfyUI
   */
  createPortraitWorkflow(inputImagePath: string): ComfyUIWorkflow {
    return {
      // Nó 1: Carregar imagem
      1: {
        class_type: 'LoadImage',
        inputs: {
          image: inputImagePath,
        },
        _meta: {
          title: 'Load Image',
        },
      },

      // Nó 2: Upscale (melhorar qualidade)
      2: {
        class_type: 'LatentUpscaleBy',
        inputs: {
          upscale_method: 'nearest-exact',
          scale: 1.5,
          samples: [1, 0],
        },
        _meta: {
          title: 'Upscale',
        },
      },

      // Nó 3: Salvar imagem
      3: {
        class_type: 'SaveImage',
        inputs: {
          images: [2, 0],
          filename_prefix: 'portrait_output',
        },
        _meta: {
          title: 'Save Image',
        },
      },
    };
  }

  /**
   * Criar workflow baseado no tipo
   *
   * @param config Configuração do workflow
   * @returns Workflow do ComfyUI
   */
  createWorkflow(config: WorkflowConfig): ComfyUIWorkflow {
    switch (config.type) {
      case 'catalog':
        return this.createCatalogWorkflow(config.inputImagePath);

      case 'portrait':
        return this.createPortraitWorkflow(config.inputImagePath);

      case 'custom':
        // Para custom, você poderia passar o workflow completo
        return {};

      default:
        throw new ApiError(400, 'INVALID_WORKFLOW_TYPE', `Tipo de workflow não suportado: ${config.type}`);
    }
  }
}

// Instância única do serviço
export const comfyuiService = new ComfyUIService();

export default comfyuiService;
