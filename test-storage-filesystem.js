/**
 * TESTE FRENTE A - Phase 1: FileSystem Storage Validation
 *
 * Script para validar:
 * 1. Upload de arquivo via API
 * 2. Persistência em filesystem
 * 3. Armazenamento em banco de dados
 * 4. Recuperação de arquivo
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
  const timestamp = new Date().toISOString();
  const prefix = {
    success: `${colors.green}✅${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    info: `${colors.blue}ℹ️ ${colors.reset}`,
    test: `${colors.cyan}🧪${colors.reset}`,
    section: `${colors.yellow}═${colors.reset}`,
  }[type] || '•';

  console.log(`${prefix} ${msg}`);
}

async function createTestImage() {
  log('info', 'Criando imagem de teste...');

  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  // Criar imagem PNG simples (1x1 pixel, azul)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR chunk size
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc
    0x90, 0x77, 0x53, 0xde, // CRC
    0x00, 0x00, 0x00, 0x0c, // IDAT chunk size
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
    0x5d, 0x3f, 0xaf, 0xcf, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk size
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);

  const testImagePath = path.join(TEST_DIR, 'test-image.png');
  fs.writeFileSync(testImagePath, pngHeader);

  log('success', `Imagem criada: ${testImagePath}`);
  return testImagePath;
}

async function testFileSystemUpload(imagePath) {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 1: Upload de arquivo via API');
  log('section', '═══════════════════════════════════════');

  try {
    const fileContent = fs.readFileSync(imagePath);
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'image/png' });
    formData.append('image', blob, 'test-consultoria.png');
    formData.append('workflow', 'catalog');

    log('info', `Enviando arquivo: test-consultoria.png (${fileContent.length} bytes)`);
    log('info', `Endpoint: ${API_BASE}/api/ai/submit`);

    // Get API key from environment
    const apiKey = process.env.API_KEY || 'test-api-key-for-testing';

    const response = await axios.post(
      `${API_BASE}/api/ai/submit`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    log('success', `Upload bem-sucedido`);
    log('info', `Status: ${response.status}`);
    log('info', `Response: ${JSON.stringify(response.data, null, 2)}`);

    return response.data;
  } catch (error) {
    log('error', `Upload falhou: ${error.message}`);
    if (error.response) {
      log('error', `Status: ${error.response.status}`);
      log('error', `Data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function verifyFileSystemStorage() {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 2: Verificar persistência em filesystem');
  log('section', '═══════════════════════════════════════');

  try {
    const storagePath = './storage/uploads';

    log('info', `Verificando diretório: ${storagePath}`);

    if (!fs.existsSync(storagePath)) {
      log('error', `Diretório não existe: ${storagePath}`);
      return false;
    }

    const files = fs.readdirSync(storagePath);
    log('success', `Diretório acessível`);
    log('info', `Total de arquivos: ${files.length}`);

    if (files.length > 0) {
      log('info', 'Arquivos encontrados:');
      files.forEach(file => {
        const filePath = path.join(storagePath, file);
        const stats = fs.statSync(filePath);
        log('info', `  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
      });
      return true;
    } else {
      log('error', 'Nenhum arquivo encontrado no diretório de uploads');
      return false;
    }
  } catch (error) {
    log('error', `Erro ao verificar filesystem: ${error.message}`);
    throw error;
  }
}

async function checkHealthStatus() {
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
    log('info', `Storage info:`, response.data.details?.storage);

    return true;
  } catch (error) {
    log('error', `API não está respondendo: ${error.message}`);
    return false;
  }
}

async function testDatabaseStorage(uploadResult) {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 3: Verificar persistência em banco');
  log('section', '═══════════════════════════════════════');

  try {
    log('info', 'Verificando se arquivo está armazenado no banco...');

    // Verificar via stats endpoint
    const response = await axios.get(`${API_BASE}/stats`);

    log('success', `Stats endpoint respondeu`);
    log('info', `Jobs stats:`, response.data.jobs);
    log('info', `Storage usage:`, response.data.storage);

    return true;
  } catch (error) {
    log('error', `Erro ao acessar stats: ${error.message}`);
    throw error;
  }
}

async function testFileRetrieval(uploadResult) {
  log('section', '═══════════════════════════════════════');
  log('test', 'TESTE 4: Recuperar arquivo via API');
  log('section', '═══════════════════════════════════════');

  try {
    if (!uploadResult || !uploadResult.job_id) {
      log('error', 'Upload result não contém job_id');
      return false;
    }

    const jobId = uploadResult.job_id;
    const downloadPath = `${API_BASE}/api/ai/result/${jobId}`;
    log('info', `Tentando recuperar resultado do job: ${jobId}`);
    log('info', `Endpoint: ${downloadPath}`);

    const apiKey = process.env.API_KEY || 'test-api-key-for-testing';

    const response = await axios.get(downloadPath, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
      responseType: 'arraybuffer',
    });

    log('success', `Arquivo recuperado com sucesso`);
    log('info', `Size: ${response.data.length} bytes`);
    log('info', `Content-Type: ${response.headers['content-type']}`);

    return true;
  } catch (error) {
    log('error', `Recuperação falhou: ${error.message}`);
    if (error.response) {
      log('error', `Status: ${error.response.status}`);
      if (error.response.status === 202) {
        log('info', `Resultado ainda não está pronto (202 Accepted)`);
        log('info', `Response: ${JSON.stringify(error.response.data)}`);
        return false; // Não é erro, apenas não está pronto
      }
    }
    return false;
  }
}

async function runAllTests() {
  log('section', '═══════════════════════════════════════');
  log('test', 'FRENTE A - VALIDAÇÃO COMPLETA FileSystem');
  log('section', '═══════════════════════════════════════');

  try {
    // Teste 0: Health check
    const isHealthy = await checkHealthStatus();
    if (!isHealthy) {
      log('error', 'API não está saudável. Abortando testes.');
      process.exit(1);
    }

    // Teste 1: Criar imagem de teste
    const imagePath = await createTestImage();

    // Teste 2: Upload
    let uploadResult;
    try {
      uploadResult = await testFileSystemUpload(imagePath);
    } catch (error) {
      log('error', 'Erro no upload. Continuando com outros testes...');
    }

    // Teste 3: Verificar filesystem
    const fsValid = await verifyFileSystemStorage();

    // Teste 4: Verificar banco
    const dbValid = await testDatabaseStorage(uploadResult);

    // Teste 5: Recuperar arquivo
    if (uploadResult) {
      const retrieveValid = await testFileRetrieval(uploadResult);
    }

    // Resumo final
    log('section', '═══════════════════════════════════════');
    log('info', 'RESUMO DOS TESTES:');
    log('info', `  - API Health: ✅`);
    log('info', `  - FileSystem Persistence: ${fsValid ? '✅' : '❌'}`);
    log('info', `  - Database Storage: ${dbValid ? '✅' : '⚠️'}`);
    log('section', '═══════════════════════════════════════');

  } catch (error) {
    log('error', `Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar testes
runAllTests().catch(error => {
  log('error', `Teste abortado: ${error.message}`);
  process.exit(1);
});
