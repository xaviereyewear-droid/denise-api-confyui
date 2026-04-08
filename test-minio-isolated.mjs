/**
 * TESTE ISOLADO: MinIO Client
 *
 * Objetivo: Diagnosticar problema de InvalidEndpointError
 * Executa fora da API Express para isolamento máximo
 *
 * Script testa:
 * 1. Inicialização do client
 * 2. Verificação de conectividade
 * 3. Bucket operations
 * 4. Upload/Download
 * 5. Error handling
 */

import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════

const CONFIG = {
  // Variação 1: Com protocolo
  endpoint_v1: 'http://localhost:9000',

  // Variação 2: Sem protocolo, com porta
  endpoint_v2: 'localhost:9000',

  // Variação 3: Nome do container Docker
  endpoint_v3: 'minio:9000',

  // Variação 4: IP do container Docker
  endpoint_v4: '172.18.0.2:9000',

  // Variação 5: Apenas host
  endpoint_v5: 'localhost',

  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
  bucket: 'comfyui',
  useSSL: false,
  region: 'us-east-1',
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(type, msg, data = null) {
  const prefix = {
    success: `${colors.green}✅${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`,
    info: `${colors.blue}ℹ️ ${colors.reset}`,
    test: `${colors.cyan}🧪${colors.reset}`,
    section: `${colors.yellow}═${colors.reset}`,
    warning: `${colors.magenta}⚠️ ${colors.reset}`,
  }[type] || '•';

  const message = data ? `${msg} ${JSON.stringify(data, null, 2)}` : msg;
  console.log(`${prefix} ${message}`);
}

// ════════════════════════════════════════════════════════════════
// TESTES DE INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════════

async function testInitialization(endpoint, variant) {
  log('section', '─────────────────────────────────────────');
  log('test', `Variante ${variant}: "${endpoint}"`);
  log('section', '─────────────────────────────────────────');

  try {
    // Tentar inicializar client
    const client = new Minio.Client({
      endPoint: endpoint,
      accessKey: CONFIG.accessKey,
      secretKey: CONFIG.secretKey,
      useSSL: CONFIG.useSSL,
      region: CONFIG.region,
    });

    log('success', `Client criado com sucesso`);
    log('info', `Endpoint: ${endpoint}`);
    log('info', `Bucket: ${CONFIG.bucket}`);

    return client;
  } catch (error) {
    log('error', `Erro ao criar client`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);

    if (error.stack) {
      log('info', `Stack trace:`);
      console.log(error.stack);
    }

    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// TESTE DE CONECTIVIDADE
// ════════════════════════════════════════════════════════════════

async function testConnectivity(client, variant) {
  if (!client) {
    log('error', `Client não foi criado, pulando conectividade`);
    return false;
  }

  try {
    log('info', `Testando conectividade...`);

    // Listar buckets para verificar conexão
    const buckets = await client.listBuckets();

    log('success', `Conectado com sucesso`);
    log('info', `Buckets encontrados: ${buckets.length}`);

    buckets.forEach(b => {
      log('info', `  - ${b.name}`);
    });

    return true;
  } catch (error) {
    log('error', `Erro na conectividade`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// TESTE DE BUCKET OPERATIONS
// ════════════════════════════════════════════════════════════════

async function testBucketOps(client, variant) {
  if (!client) {
    log('error', `Client não foi criado, pulando bucket operations`);
    return false;
  }

  try {
    log('info', `Verificando bucket "${CONFIG.bucket}"...`);

    const exists = await client.bucketExists(CONFIG.bucket);

    if (exists) {
      log('success', `Bucket existe`);
    } else {
      log('warning', `Bucket não existe, criando...`);
      await client.makeBucket(CONFIG.bucket, CONFIG.region);
      log('success', `Bucket criado com sucesso`);
    }

    return true;
  } catch (error) {
    log('error', `Erro em bucket operations`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// TESTE DE UPLOAD
// ════════════════════════════════════════════════════════════════

async function testUpload(client, variant) {
  if (!client) {
    log('error', `Client não foi criado, pulando upload`);
    return null;
  }

  try {
    log('info', `Preparando arquivo para upload...`);

    // Criar arquivo de teste
    const testDir = './test-artifacts';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const jpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
    const buffer = Buffer.from(jpegBase64, 'base64');
    const filepath = path.join(testDir, `test-minio-${Date.now()}.jpg`);

    fs.writeFileSync(filepath, buffer);
    log('success', `Arquivo criado: ${filepath} (${buffer.length} bytes)`);

    // Upload
    log('info', `Fazendo upload...`);
    const objectName = `tests/test-file-${Date.now()}.jpg`;

    await client.fPutObject(
      CONFIG.bucket,
      objectName,
      filepath,
      {
        'Content-Type': 'image/jpeg',
        'X-Test': 'isolated-test',
      }
    );

    log('success', `Upload concluído`);
    log('info', `Object Name: ${objectName}`);

    // Limpeza local
    fs.unlinkSync(filepath);

    return objectName;
  } catch (error) {
    log('error', `Erro no upload`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// TESTE DE LISTAGEM
// ════════════════════════════════════════════════════════════════

async function testList(client, variant) {
  if (!client) {
    log('error', `Client não foi criado, pulando listagem`);
    return [];
  }

  try {
    log('info', `Listando objetos no bucket...`);

    const objects = [];
    const objectsStream = client.listObjects(CONFIG.bucket, 'tests/', true);

    return new Promise((resolve, reject) => {
      objectsStream.on('data', (obj) => {
        objects.push(obj);
      });

      objectsStream.on('error', (err) => {
        log('error', `Erro ao listar objetos`);
        log('error', `Mensagem: ${err.message}`);
        reject(err);
      });

      objectsStream.on('end', () => {
        log('success', `Objetos listados: ${objects.length}`);
        objects.forEach(obj => {
          log('info', `  - ${obj.name} (${obj.size} bytes)`);
        });
        resolve(objects);
      });
    });
  } catch (error) {
    log('error', `Erro na listagem`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);
    return [];
  }
}

// ════════════════════════════════════════════════════════════════
// TESTE DE DOWNLOAD
// ════════════════════════════════════════════════════════════════

async function testDownload(client, objectName, variant) {
  if (!client || !objectName) {
    log('error', `Client ou objectName não disponível, pulando download`);
    return false;
  }

  try {
    log('info', `Fazendo download de "${objectName}"...`);

    const downloadDir = './test-artifacts';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const downloadPath = path.join(downloadDir, `downloaded-${Date.now()}.jpg`);

    await client.fGetObject(CONFIG.bucket, objectName, downloadPath);

    const stats = fs.statSync(downloadPath);
    log('success', `Download concluído`);
    log('info', `Arquivo: ${downloadPath} (${stats.size} bytes)`);

    // Limpeza
    fs.unlinkSync(downloadPath);

    return true;
  } catch (error) {
    log('error', `Erro no download`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// TESTE DE DELEÇÃO
// ════════════════════════════════════════════════════════════════

async function testDelete(client, objectName, variant) {
  if (!client || !objectName) {
    log('error', `Client ou objectName não disponível, pulando deleção`);
    return false;
  }

  try {
    log('info', `Deletando objeto...`);

    await client.removeObject(CONFIG.bucket, objectName);

    log('success', `Objeto deletado com sucesso`);
    return true;
  } catch (error) {
    log('error', `Erro na deleção`);
    log('error', `Tipo: ${error.name}`);
    log('error', `Mensagem: ${error.message}`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('');
  log('section', '╔════════════════════════════════════════╗');
  log('test', '   TESTE ISOLADO: MinIO Client');
  log('section', '╚════════════════════════════════════════╝');
  console.log('');

  const variants = [
    { name: '1 (com protocolo)', endpoint: CONFIG.endpoint_v1 },
    { name: '2 (sem protocolo)', endpoint: CONFIG.endpoint_v2 },
    { name: '3 (nome container)', endpoint: CONFIG.endpoint_v3 },
    { name: '4 (IP container)', endpoint: CONFIG.endpoint_v4 },
    { name: '5 (apenas host)', endpoint: CONFIG.endpoint_v5 },
  ];

  const results = {};

  for (const variant of variants) {
    console.log('');

    // Teste de inicialização
    const client = await testInitialization(variant.endpoint, variant.name);
    results[variant.name] = {
      init: client !== null,
      connectivity: false,
      bucket: false,
      upload: false,
      list: false,
      download: false,
      delete: false,
    };

    if (!client) {
      console.log('');
      continue;
    }

    // Teste de conectividade
    const connOk = await testConnectivity(client, variant.name);
    results[variant.name].connectivity = connOk;
    console.log('');

    if (!connOk) continue;

    // Teste de bucket
    const bucketOk = await testBucketOps(client, variant.name);
    results[variant.name].bucket = bucketOk;
    console.log('');

    if (!bucketOk) continue;

    // Teste de upload
    const objectName = await testUpload(client, variant.name);
    results[variant.name].upload = objectName !== null;
    console.log('');

    if (!objectName) continue;

    // Teste de listagem
    const objects = await testList(client, variant.name);
    results[variant.name].list = objects.length > 0;
    console.log('');

    // Teste de download
    const downloadOk = await testDownload(client, objectName, variant.name);
    results[variant.name].download = downloadOk;
    console.log('');

    // Teste de deleção
    const deleteOk = await testDelete(client, objectName, variant.name);
    results[variant.name].delete = deleteOk;
    console.log('');
  }

  // ════════════════════════════════════════════════════════════════
  // RESUMO
  // ════════════════════════════════════════════════════════════════

  log('section', '╔════════════════════════════════════════╗');
  log('info', '           RESUMO DOS TESTES');
  log('section', '╚════════════════════════════════════════╝');
  console.log('');

  console.log('Variante | Init | Conn | Bucket | Upload | List | Download | Delete');
  console.log('━'.repeat(70));

  for (const [variant, result] of Object.entries(results)) {
    const cells = [
      variant.padEnd(10),
      result.init ? '✅' : '❌',
      result.connectivity ? '✅' : '❌',
      result.bucket ? '✅' : '❌',
      result.upload ? '✅' : '❌',
      result.list ? '✅' : '❌',
      result.download ? '✅' : '❌',
      result.delete ? '✅' : '❌',
    ];
    console.log(cells.join(' | '));
  }

  console.log('');

  // Encontrar variante que funcionou
  const working = Object.entries(results).find(([_, r]) => r.delete === true);

  console.log('');
  if (working) {
    log('success', `Variante recomendada: ${working[0]}`);
    log('info', `Usar endpoint: "${variants.find(v => v.name === working[0])?.endpoint}"`);
  } else {
    log('error', `Nenhuma variante funcionou completamente`);
    log('warning', `Verificar conexão ao MinIO container`);
    log('warning', `Verificar se porta 9000 está acessível`);
    log('warning', `Verificar credenciais: minioadmin / minioadmin`);
  }

  console.log('');
}

// ════════════════════════════════════════════════════════════════
// EXECUTAR
// ════════════════════════════════════════════════════════════════

runTests().catch(error => {
  log('error', `Erro fatal: ${error.message}`);
  process.exit(1);
});
