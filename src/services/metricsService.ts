/**
 * METRICS SERVICE
 *
 * Coleta métricas com prom-client (Prometheus format)
 * Exposto em GET /metrics
 */

import {
  Counter,
  Histogram,
  Gauge,
  register,
  collectDefaultMetrics,
} from 'prom-client';
import logger from '../lib/logger.js';

/**
 * Inicializar coleta de métricas padrão do Node.js
 */
// @ts-ignore - Timeout config is not recognized in this prom-client version
collectDefaultMetrics({ timeout: 5000 });

/**
 * ═══════════════════════════════════════════════════════════════
 * MÉTRICAS CUSTOMIZADAS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Contador: Total de requisições
 */
export const httpRequestsTotal = new Counter({
  name: 'api_http_requests_total',
  help: 'Total de requisições HTTP',
  labelNames: ['method', 'path', 'status'],
});

/**
 * Histograma: Duração de requisições
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'api_http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'path'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

/**
 * Gauge: Jobs ativos
 */
export const activeJobsGauge = new Gauge({
  name: 'api_active_jobs',
  help: 'Número de jobs em processamento',
});

/**
 * Gauge: Jobs por status
 */
export const jobsPerStatusGauge = new Gauge({
  name: 'api_jobs_per_status',
  help: 'Número de jobs por status',
  labelNames: ['status'],
});

/**
 * Gauge: Saúde do ComfyUI
 */
export const comfyuiHealthGauge = new Gauge({
  name: 'api_comfyui_health',
  help: 'Saúde do ComfyUI (1=online, 0=offline)',
});

/**
 * Gauge: Tamanho do banco de dados
 */
export const databaseSizeGauge = new Gauge({
  name: 'api_database_size_mb',
  help: 'Tamanho do banco de dados em MB',
});

/**
 * Gauge: Total de jobs no banco
 */
export const totalJobsInDatabaseGauge = new Gauge({
  name: 'api_jobs_total_in_database',
  help: 'Total de jobs armazenados no banco',
});

/**
 * Counter: Erros de ComfyUI
 */
export const comfyuiErrorsTotal = new Counter({
  name: 'api_comfyui_errors_total',
  help: 'Total de erros ao contactar ComfyUI',
  labelNames: ['error_type'],
});

/**
 * Counter: Circuit breaker acionamentos
 */
export const circuitBreakerTripsTotal = new Counter({
  name: 'api_circuit_breaker_trips_total',
  help: 'Total de vezes que o circuit breaker foi acionado',
  labelNames: ['service'],
});

/**
 * Métodos para atualizar métricas
 */
export const metrics = {
  /**
   * Registrar requisição HTTP
   */
  recordHttpRequest(method: string, path: string, statusCode: number, durationMs: number) {
    httpRequestsTotal.labels(method, path, statusCode.toString()).inc();
    httpRequestDurationSeconds.labels(method, path).observe(durationMs / 1000);
  },

  /**
   * Atualizar jobs ativos
   */
  updateActiveJobs(count: number) {
    activeJobsGauge.set(count);
  },

  /**
   * Atualizar jobs por status
   */
  updateJobsPerStatus(statusCounts: Record<string, number>) {
    for (const [status, count] of Object.entries(statusCounts)) {
      jobsPerStatusGauge.labels(status).set(count);
    }
  },

  /**
   * Atualizar saúde do ComfyUI
   */
  setComfyuiHealth(isHealthy: boolean) {
    comfyuiHealthGauge.set(isHealthy ? 1 : 0);
  },

  /**
   * Atualizar tamanho do BD
   */
  setDatabaseSize(sizeMb: number) {
    databaseSizeGauge.set(sizeMb);
  },

  /**
   * Atualizar total de jobs no BD
   */
  setTotalJobsInDatabase(count: number) {
    totalJobsInDatabaseGauge.set(count);
  },

  /**
   * Registrar erro de ComfyUI
   */
  recordComfyuiError(errorType: string) {
    comfyuiErrorsTotal.labels(errorType).inc();
  },

  /**
   * Registrar acionamento de circuit breaker
   */
  recordCircuitBreakerTrip(service: string) {
    circuitBreakerTripsTotal.labels(service).inc();
  },

  /**
   * Obter todas as métricas em formato Prometheus
   */
  async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error({ error }, 'Erro ao obter métricas');
      return '';
    }
  },

  /**
   * Obter content-type do Prometheus
   */
  getContentType(): string {
    return register.contentType;
  },
};

export default metrics;
