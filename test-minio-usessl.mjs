/**
 * TESTE: Configuração de useSSL
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

async function testConfig(name, config) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${colors.blue}${name}${colors.reset}`);
  console.log(`Config: useSSL=${config.useSSL}`);

  try {
    const client = new Minio.Client(config);
    log('ok', 'Client criado');

    const buckets = await client.listBuckets();
    log('ok', `✅ FUNCIONOU! Buckets: ${buckets.length}`);
    return true;
  } catch (error) {
    log('error', `Erro: ${error.message.split('\n')[0]}`);
    return false;
  }
}

async function main() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════╗`);
  console.log(`║    TESTE: useSSL (SSL vs HTTP)         ║`);
  console.log(`╚════════════════════════════════════════╝${colors.reset}`);

  const configs = [
    {
      name: '1. useSSL: true (padrão)',
      config: {
        endPoint: 'localhost',
        port: 9000,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        useSSL: true,
      },
    },
    {
      name: '2. useSSL: false (HTTP)',
      config: {
        endPoint: 'localhost',
        port: 9000,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
        useSSL: false,
      },
    },
  ];

  for (const test of configs) {
    const success = await testConfig(test.name, test.config);
    if (success) {
      console.log(`\n✅ SOLUÇÃO ENCONTRADA: useSSL: false`);
      break;
    }
  }

  console.log(`\n${'━'.repeat(40)}`);
  console.log(`
Aplicar no MinIOStorageAdapter.ts:

this.client = new Minio.Client({
  endPoint: endpoint,     // 'localhost' (sem :9000)
  port: 9000,            // ← ADICIONE ISTO
  accessKey,
  secretKey,
  useSSL: false,         // ← ADICIONE/MODIFIQUE ISTO
  region,
});
  `);
}

main();
