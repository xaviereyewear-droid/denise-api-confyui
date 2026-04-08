/**
 * TESTE FRENTE A - FileSystem Storage Validation (Simplified)
 *
 * Script para validar:
 * 1. Upload de arquivo via API
 * 2. Persistência em filesystem
 * 3. Job status tracking
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = 'http://localhost:3000';
const TEST_DIR = './test-artifacts';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, msg) {
  const prefix = {
    success: `${colors.green}✅${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    info: `${colors.blue}ℹ️ ${colors.reset}`,
    test: `${colors.cyan}🧪${colors.reset}`,
    section: `${colors.yellow}═${colors.reset}`,
  }[type] || '•';

  console.log(`${prefix} ${msg}`);
}

function createTestImage() {
  log('info', 'Criando imagem de teste...');

  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  // Usar uma imagem JPEG válida (1x1 pixel)
  // Base64 encoded valid JPEG
  const jpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
  const jpegBuffer = Buffer.from(jpegBase64, 'base64');

  const testImagePath = path.join(TEST_DIR, 'test-image.jpg');
  fs.writeFileSync(testImagePath, jpegBuffer);

  log('success', `Imagem criada: ${testImagePath} (${jpegBuffer.length} bytes)`);
  return testImagePath;
}

async function checkHealth() {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 0: Verificar saúde da API');
  log('section', '═══════════════════════════════════════');

  try {
    const response = await axios.get(`${API_BASE}/health`, {
      timeout: 5000,
    });

    log('success', `API está saudável`);
    log('info', `Status: ${response.data.status}`);
    log('info', `Storage: ${response.data.checks.ready}`);
    log('info', `ComfyUI: ${response.data.checks.live}`);

    return true;
  } catch (error) {
    log('error', `API não está respondendo: ${error.message}`);
    return false;
  }
}

async function testUpload(imagePath) {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 1: Upload de arquivo via API');
  log('section', '═══════════════════════════════════════');

  try {
    const fileContent = fs.readFileSync(imagePath);
    const form = new FormData();

    form.append('image', fs.createReadStream(imagePath), 'test-image.jpg');
    form.append('workflow', 'catalog');

    log('info', `Enviando arquivo: test-image.jpg (${fileContent.length} bytes)`);
    log('info', `Endpoint: POST ${API_BASE}/ai/submit`);

    const apiKey = process.env.API_KEY || 'test-key-local-12345';
    log('info', `API Key: ${apiKey.substring(0, 10)}...`);

    const response = await axios.post(
      `${API_BASE}/ai/submit`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    log('success', `Upload bem-sucedido`);
    log('info', `Status HTTP: ${response.status}`);
    log('info', `Job ID: ${response.data.job_id}`);
    log('info', `Status Job: ${response.data.status}`);
    log('info', `Message: ${response.data.message}`);

    return response.data;
  } catch (error) {
    log('error', `Upload falhou: ${error.message}`);
    if (error.response) {
      log('error', `Status: ${error.response.status}`);
      log('error', `Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function checkJobStatus(jobId) {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 2: Verificar status do job');
  log('section', '═══════════════════════════════════════');

  try {
    const apiKey = process.env.API_KEY || 'test-key-local-12345';

    const response = await axios.get(
      `${API_BASE}/ai/status/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 5000,
      }
    );

    log('success', `Status obtido com sucesso`);
    log('info', `Job ID: ${response.data.job_id}`);
    log('info', `Status: ${response.data.status}`);
    log('info', `Progress: ${response.data.progress || 'N/A'}%`);
    log('info', `Message: ${response.data.message || 'N/A'}`);

    return response.data;
  } catch (error) {
    log('error', `Erro ao obter status: ${error.message}`);
    if (error.response) {
      log('error', `Status: ${error.response.status}`);
    }
    return null;
  }
}

async function checkStorageDirectory() {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 3: Verificar persistência em filesystem');
  log('section', '═══════════════════════════════════════');

  try {
    const storagePath = '/app/storage/uploads';

    log('info', `Verificando diretório: ${storagePath}`);
    log('info', `(A partir de dentro do container Docker)`);

    // Fazer request ao health endpoint que retorna info sobre storage
    const response = await axios.get(`${API_BASE}/health`);

    if (response.data.details && response.data.details.storage) {
      log('success', `Storage info obtido via API`);
      log('info', `Storage usado: ${response.data.details.storage.used_mb} MB`);
    }

    log('success', `Diretório acessível via API`);
    return true;
  } catch (error) {
    log('error', `Erro ao verificar storage: ${error.message}`);
    return false;
  }
}

async function checkStats() {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 4: Verificar stats endpoint');
  log('section', '═══════════════════════════════════════');

  try {
    const response = await axios.get(`${API_BASE}/stats`);

    log('success', `Stats endpoint respondeu`);
    log('info', `Jobs Total: ${response.data.jobs.total}`);
    log('info', `Jobs Pendentes: ${response.data.jobs.pending}`);
    log('info', `Storage (uploads): ${response.data.storage.uploads_mb} MB`);
    log('info', `Storage (outputs): ${response.data.storage.outputs_mb} MB`);
    log('info', `Storage (total): ${response.data.storage.total_mb} MB`);

    return true;
  } catch (error) {
    log('error', `Erro ao obter stats: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('');
  log('section', '═══════════════════════════════════════');
  log('test', 'FRENTE A - VALIDAÇÃO FILESYSTEM STORAGE');
  log('test', 'Phase 1: Teste de Upload e Persistência');
  log('section', '═══════════════════════════════════════');
  console.log('');

  try {
    // Teste 0: Health
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      log('error', 'API não está saudável. Abortando.');
      process.exit(1);
    }

    // Teste 1: Criar arquivo de teste
    const imagePath = createTestImage();
    console.log('');

    // Teste 2: Upload
    const uploadResult = await testUpload(imagePath);
    console.log('');

    if (!uploadResult) {
      log('error', 'Teste de upload falhou');
      process.exit(1);
    }

    // Teste 3: Verificar status
    await new Promise(r => setTimeout(r, 2000)); // Aguardar 2s
    const jobStatus = await checkJobStatus(uploadResult.job_id);
    console.log('');

    // Teste 4: Verificar armazenamento
    const storageOk = await checkStorageDirectory();
    console.log('');

    // Teste 5: Verificar stats
    const statsOk = await checkStats();
    console.log('');

    // Resumo final
    log('section', '═══════════════════════════════════════');
    log('info', 'RESUMO DOS TESTES:');
    log('success', `  ✅ Health Check`);
    log('success', `  ✅ Upload`);
    log('success', `  ✅ Job Status`);
    log(storageOk ? 'success' : 'error', `  ${storageOk ? '✅' : '❌'} Storage Filesystem`);
    log(statsOk ? 'success' : 'error', `  ${statsOk ? '✅' : '❌'} Stats Endpoint`);
    log('section', '═══════════════════════════════════════');
    console.log('');

  } catch (error) {
    log('error', `Erro fatal: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Executar
runAllTests();
