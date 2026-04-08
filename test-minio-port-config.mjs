/**
 * TESTE: Configuração correta de porta no MinIO client
 *
 * O problema pode ser que a porta deve ser passada separadamente
 * Testando diferentes formatos de configuração
 */

import * as Minio from 'minio';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(status, msg) {
  const icon = status === 'ok' ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`;
  console.log(`${icon} ${msg}`);
}

async function testConfig(configName, config) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${colors.blue}Test: ${configName}${colors.reset}`);
  console.log(`Config: ${JSON.stringify(config, null, 2)}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    const client = new Minio.Client(config);
    log('ok', 'Client criado com sucesso');

    // Tentar listar buckets para verificar conexão
    try {
      const buckets = await client.listBuckets();
      log('ok', `Conectado! Buckets: ${buckets.length}`);
      return true;
    } catch (connError) {
      log('error', `Erro de conexão: ${connError.message}`);
      return false;
    }
  } catch (error) {
    log('error', `Erro ao criar client: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════╗`);
  console.log(`║   TESTE: Formato correto de porta      ║`);
  console.log(`╚════════════════════════════════════════╝${colors.reset}\n`);

  const configs = [
    {
      name: '1. Endpoint com porta (errado)',
      config: {
        endPoint: 'localhost:9000',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
      },
    },
    {
      name: '2. Endpoint + port (separados)',
      config: {
        endPoint: 'localhost',
        port: 9000,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
      },
    },
    {
      name: '3. Apenas endpoint, sem porta',
      config: {
        endPoint: 'localhost',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
      },
    },
    {
      name: '4. Endpoint minio + port',
      config: {
        endPoint: 'minio',
        port: 9000,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
      },
    },
  ];

  let working = null;

  for (const test of configs) {
    const success = await testConfig(test.name, test.config);
    if (success) {
      working = test;
    }
  }

  console.log(`\n${'━'.repeat(40)}`);
  if (working) {
    log('ok', `✅ FORMATO CORRETO ENCONTRADO!`);
    console.log(`\nUse essa configuração:`);
    console.log(`${JSON.stringify(working.config, null, 2)}`);
    console.log(`\nNo MinIOStorageAdapter.ts, modifique:`);
    console.log(`  endPoint: endpoint,`);
    console.log(`  port: port, // ADICIONE ISTO`);
  } else {
    log('error', `Nenhuma configuração funcionou`);
    log('error', `Verifique se MinIO está acessível em localhost:9000`);
  }
  console.log(`${'━'.repeat(40)}\n`);
}

runTests();
