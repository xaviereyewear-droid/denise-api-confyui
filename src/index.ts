/**
 * PONTO DE ENTRADA PRINCIPAL DA API
 *
 * Inicializa o servidor Express com todas as configurações,
 * middlewares e rotas.
 */

import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import logger from './lib/logger.js';
import router from './routes/index.js';
import { ipLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initializeDatabase, closeDatabase, getDatabaseInfo } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import { createJobRepository } from './repositories/jobRepository.js';
import { initializeJobRecovery } from './services/jobRecovery.js';
import requestLoggerMiddleware from './middleware/requestLogger.js';
import securityHeadersMiddleware from './middleware/securityHeaders.js';
import { metrics } from './services/metricsService.js';
import { initializeGracefulShutdown } from './services/shutdownService.js';
import jobService from './services/jobService.js';

/**
 * Inicializar Express
 */
const app = express();

/**
 * MIDDLEWARES GLOBAIS
 */

// Security headers (deve ser primeiro)
app.use(securityHeadersMiddleware);

// Logging de requisições
app.use((req, _res, next) => {
  logger.debug(
    { method: req.method, path: req.path },
    'Requisição recebida'
  );
  next();
});

// Parser JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS - Aceita localhost + Cloudflare Tunnel
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://imagemsecreta.com',
];

// Adicionar URL do Tunnel se configurada
if (process.env.CLOUDFLARE_TUNNEL_URL) {
  corsOrigins.push(process.env.CLOUDFLARE_TUNNEL_URL);
}

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logger (registra duração + métricas)
app.use(requestLoggerMiddleware);

// Rate limiting global
app.use(ipLimiter);

/**
 * ROTAS
 */

// Endpoint de métricas (Prometheus format)
app.get('/metrics', async (_req, res) => {
  try {
    const metricsText = await metrics.getMetrics();
    res.set('Content-Type', metrics.getContentType());
    res.send(metricsText);
  } catch (error) {
    logger.error({ error }, 'Erro ao obter métricas');
    res.status(500).send('Erro ao obter métricas');
  }
});

// Rotas principais
app.use('/', router);

/**
 * TRATAMENTO DE ERROS E 404
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * INICIALIZAR BANCO DE DADOS
 */
logger.info('Inicializando banco de dados SQLite...');
const db = initializeDatabase();
runMigrations(db);

// Criar repository e recovery service
const jobRepository = createJobRepository(db);
const jobRecovery = initializeJobRecovery(jobRepository);

// Inicializar jobService com repository
jobService.initRepository();

/**
 * INICIALIZAR GRACEFUL SHUTDOWN
 */
let server: any;

/**
 * INICIAR SERVIDOR
 */
server = app.listen(config.apiPort, config.apiHost, async () => {
  // Registrar graceful shutdown handlers
  initializeGracefulShutdown(server);
  const tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL || '';
  const dbInfo = getDatabaseInfo();

  logger.info(
    {
      host: config.apiHost,
      port: config.apiPort,
      comfyui: config.comfyui.baseUrl,
      env: config.nodeEnv,
      tunnel: tunnelUrl || 'não configurado',
      database: dbInfo,
    },
    '✅ Servidor iniciado com sucesso!'
  );

  // Executar job recovery (não bloqueia startup)
  try {
    await jobRecovery.recoverIncompleteJobs();
  } catch (error) {
    logger.warn({ error }, 'Aviso: Job recovery encontrou erro, continuando');
  }

  // Atualizar métricas periodicamente (a cada 10 segundos)
  setInterval(() => {
    const stats = jobService.getStats();
    metrics.updateJobsPerStatus({
      pending: jobRepository.list({ status: 'pending' }).length,
      queued: stats.queued,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      cancelled: 0,
    });
    metrics.updateActiveJobs(stats.queued + stats.processing);

    const dbInfo = getDatabaseInfo();
    if (dbInfo) {
      metrics.setDatabaseSize(parseFloat(dbInfo.size_mb));
      metrics.setTotalJobsInDatabase(dbInfo.jobs);
    }
  }, 10000);

  const maxWidth = 50;
  const localUrl = `http://${config.apiHost}:${config.apiPort}`;
  const publicUrl = tunnelUrl ? `🌐 Público  → ${tunnelUrl}` : '';

  console.log(`
╔${'═'.repeat(maxWidth)}╗
║${'🚀 API ComfyUI - ETAPA 9 Session 2'.padStart((maxWidth + '🚀 API ComfyUI - ETAPA 9 Session 2'.length) / 2).padEnd(maxWidth)}║
╠${'═'.repeat(maxWidth)}╣
║                                                  ║
║  📡 Local   → ${localUrl.padEnd(maxWidth - 15)}║
${publicUrl ? `║  ${publicUrl.padEnd(maxWidth - 1)}║\n` : ''}║  🎨 ComfyUI → ${config.comfyui.baseUrl.padEnd(maxWidth - 15)}║
║  📊 Métricas → /metrics (Prometheus format)      ║
║  📝 Logs    → ${config.logLevel.padEnd(maxWidth - 15)}║
║  🔐 Auth    → ${(config.apiKey.substring(0, 15) + '...').padEnd(maxWidth - 15)}║
║  🛡️  Security → Headers + Rate Limiting Active   ║
║                                                  ║
╚${'═'.repeat(maxWidth)}╝
  `);
});

/**
 * TRATAMENTO DE SINAIS PARA SHUTDOWN GRACIOSO
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido. Encerrando servidor...');
  server.close(() => {
    closeDatabase();
    logger.info('Servidor encerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido. Encerrando servidor...');
  server.close(() => {
    closeDatabase();
    logger.info('Servidor encerrado.');
    process.exit(0);
  });
});

/**
 * TRATAMENTO DE ERROS NÃO CAPTURADOS
 */
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Exceção não capturada');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Promise rejection não tratada');
  process.exit(1);
});

export default app;
