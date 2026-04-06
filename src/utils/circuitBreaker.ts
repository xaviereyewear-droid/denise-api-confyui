/**
 * CIRCUIT BREAKER PATTERN
 *
 * Protege API contra falhas em serviço externo (ComfyUI)
 * Estados: CLOSED → OPEN → HALF_OPEN
 */

import logger from '../lib/logger.js';
import { metrics } from '../services/metricsService.js';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // Falhas antes de abrir
  resetTimeoutMs?: number;   // Tempo antes de tentar HALF_OPEN
  monitoringPeriodMs?: number; // Janela para contar falhas
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'name'>> = {
  failureThreshold: 10,       // Conservador: 10 falhas = abrir
  resetTimeoutMs: 30000,      // 30 segundos antes de tentar recuperar
  monitoringPeriodMs: 60000,  // Janela de 1 minuto
};

/**
 * Erro de circuit breaker
 */
export class CircuitBreakerOpenError extends Error {
  constructor(public readonly serviceName: string) {
    super(`Circuit breaker aberto para ${serviceName}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastOpenTime = 0;
  private options: Required<Omit<CircuitBreakerOptions, 'name'>>;

  constructor(private name: string, options?: Omit<CircuitBreakerOptions, 'name'>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    logger.info(
      {
        name,
        failureThreshold: this.options.failureThreshold,
        resetTimeoutMs: this.options.resetTimeoutMs,
      },
      `Circuit Breaker inicializado para ${name}`
    );
  }

  /**
   * Executar função através do circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Se OPEN, checar se é hora de tentar HALF_OPEN
    if (this.state === 'OPEN') {
      const timeSinceOpen = Date.now() - this.lastOpenTime;

      if (timeSinceOpen < this.options.resetTimeoutMs) {
        // Ainda em timeout, rejeitar imediatamente
        throw new CircuitBreakerOpenError(this.name);
      }

      // Timeout passou, mudar para HALF_OPEN
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      logger.info({ name: this.name }, '🔄 Circuit breaker em HALF_OPEN');
    }

    // Executar função
    try {
      const result = await fn();

      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Registrar sucesso
   */
  private recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // 1 sucesso em HALF_OPEN → CLOSED
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.successCount = 0;

      logger.info(
        { name: this.name },
        '✅ Circuit breaker CLOSED (recuperado)'
      );

      metrics.recordCircuitBreakerTrip(this.name);
      return;
    }

    if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  /**
   * Registrar falha
   */
  private recordFailure(): void {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;

    // Resetar contador se passou a janela de monitoramento
    if (timeSinceLastFailure > this.options.monitoringPeriodMs) {
      this.failureCount = 0;
    }

    this.failureCount++;
    this.lastFailureTime = now;

    logger.warn(
      {
        name: this.name,
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
        state: this.state,
      },
      `Falha registrada (${this.failureCount}/${this.options.failureThreshold})`
    );

    // Verificar se deve abrir
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.lastOpenTime = now;

      logger.error(
        { name: this.name, failureCount: this.failureCount },
        '🔴 Circuit breaker ABERTO (falhas excessivas)'
      );

      metrics.recordCircuitBreakerTrip(this.name);
    }
  }

  /**
   * Obter estado do circuit breaker
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Obter status detalhado
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      isOpen: this.state === 'OPEN',
      isClosed: this.state === 'CLOSED',
      isHalfOpen: this.state === 'HALF_OPEN',
      timeSinceLastFailure: Date.now() - this.lastFailureTime,
    };
  }

  /**
   * Resetar circuit breaker (debugging/admin)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    logger.info({ name: this.name }, 'Circuit breaker resetado');
  }
}

export default CircuitBreaker;
