/**
 * RETRY UTILITY
 *
 * Implementa retry com exponential backoff
 */

import logger from '../lib/logger.js';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onAttempt?: (attempt: number, delay: number, error?: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  onAttempt: () => {},
};

/**
 * Executar função com retry automático
 *
 * @param fn Função a executar
 * @param options Configurações de retry
 * @returns Resultado da função
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Executar função
      const result = await fn();

      // Sucesso
      if (attempt > 1) {
        logger.info(
          { attempt, retriesNeeded: attempt - 1 },
          '✅ Operação sucedeu após retries'
        );
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Se não é última tentativa, aguardar e tentar novamente
      if (attempt < opts.maxAttempts) {
        logger.warn(
          {
            attempt,
            maxAttempts: opts.maxAttempts,
            error: lastError.message,
            nextRetryMs: delay,
          },
          `⚠️  Tentativa ${attempt} falhou, aguardando ${delay}ms antes de retry`
        );

        // Chamar callback
        opts.onAttempt(attempt, delay, lastError);

        // Aguardar
        await sleep(delay);

        // Aumentar delay para próxima tentativa (exponential backoff)
        delay = Math.min(
          opts.maxDelayMs,
          delay * opts.backoffMultiplier
        );
      }
    }
  }

  // Todas as tentativas falharam
  logger.error(
    {
      maxAttempts: opts.maxAttempts,
      error: lastError?.message,
    },
    `❌ Todas as ${opts.maxAttempts} tentativas falharam`
  );

  throw lastError;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry com logging mais verboso para debugging
 */
export async function retryWithLogging<T>(
  fn: () => Promise<T>,
  operationName: string,
  options?: RetryOptions
): Promise<T> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    onAttempt: (attempt: number, delay: number, error?: Error) => {
      logger.debug(
        {
          operation: operationName,
          attempt,
          delayMs: delay,
          error: error?.message,
        },
        `Retry ${attempt}/${opts.maxAttempts} em ${delay}ms`
      );
      options?.onAttempt?.(attempt, delay, error);
    },
  };

  return retry(fn, opts);
}

export default retry;
