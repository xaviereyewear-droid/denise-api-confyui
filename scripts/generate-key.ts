/**
 * SCRIPT PARA GERAR UMA API KEY SEGURA
 *
 * Uso: npm run generate-key
 */

import { randomBytes } from 'crypto';

function generateApiKey(): string {
  // Gera 32 bytes aleatórios e converte para string hexadecimal
  const randomPart = randomBytes(32).toString('hex');
  return `sk_live_${randomPart}`;
}

function main() {
  const apiKey = generateApiKey();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🔐 API KEY GERADA COM SUCESSO!                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║ Copie a chave abaixo e adicione ao seu arquivo .env      ║
║                                                           ║
║ API_KEY=${apiKey}
║                                                           ║
║ ⚠️  IMPORTANTE:                                           ║
║  - Guarde essa chave em segurança                         ║
║  - Nunca compartilhe ou faça commit no git                ║
║  - Use diferente para cada ambiente (dev/prod)           ║
║  - Para revogar, gere uma nova chave                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
}

main();
