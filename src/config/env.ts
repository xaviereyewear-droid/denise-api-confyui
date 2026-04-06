/**
 * CARREGAMENTO E VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Função utilitária para validar variáveis obrigatórias
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;

  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória não encontrada: ${key}\n` +
      `Verifique seu arquivo .env (veja .env.example)`
    );
  }

  return value;
}

/**
 * CONFIGURAÇÕES CARREGADAS
 */
export const config = {
  // Servidor
  nodeEnv: getEnv('NODE_ENV', 'development'),
  apiPort: parseInt(getEnv('API_PORT', '3000')),
  apiHost: getEnv('API_HOST', 'localhost'),

  // ComfyUI
  comfyui: {
    host: getEnv('COMFYUI_HOST', 'localhost'),
    port: parseInt(getEnv('COMFYUI_PORT', '8188')),
    timeout: parseInt(getEnv('COMFYUI_TIMEOUT', '300000')),
    // URL do ComfyUI (construída dinamicamente)
    get baseUrl() {
      return `http://${this.host}:${this.port}`;
    },
  },

  // Autenticação
  apiKey: getEnv('API_KEY'),

  // Storage
  storagePath: getEnv('STORAGE_PATH', './storage'),
  uploadMaxSize: parseInt(getEnv('UPLOAD_MAX_SIZE', '10485760')), // 10MB
  cleanupInterval: parseInt(getEnv('CLEANUP_INTERVAL', '86400000')), // 24h

  // Logging
  logLevel: getEnv('LOG_LEVEL', 'info'),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '60000')), // 1 minuto
    maxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '10')),
  },

  // Cloudflare Tunnel (opcional)
  cloudflareUrl: process.env.CLOUDFLARE_TUNNEL_URL,

  // Flags
  isProduction: getEnv('NODE_ENV', 'development') === 'production',
  isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
};

// Validação na inicialização
function validateConfig() {
  const errors: string[] = [];

  if (config.apiPort < 1024 || config.apiPort > 65535) {
    errors.push(`API_PORT deve estar entre 1024 e 65535. Recebido: ${config.apiPort}`);
  }

  if (config.comfyui.port < 1024 || config.comfyui.port > 65535) {
    errors.push(`COMFYUI_PORT deve estar entre 1024 e 65535. Recebido: ${config.comfyui.port}`);
  }

  if (config.apiKey.length < 20) {
    errors.push('API_KEY deve ter pelo menos 20 caracteres. Execute: npm run generate-key');
  }

  if (errors.length > 0) {
    console.error('❌ Erros de configuração:');
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }
}

validateConfig();

export default config;
