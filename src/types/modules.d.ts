/**
 * TYPE DECLARATIONS E OVERRIDES
 * Para resolver incompatibilidades de tipos entre pacotes
 */

// Re-exportar tipos existentes
export * from './storage.js';

/**
 * Declaração estendida para BullMQ
 * Contorna incompatibilidades de versão
 */
declare module 'bullmq' {
  export class QueueScheduler {
    constructor(name: string, opts: any);
    waitUntilReady(): Promise<void>;
    close(): Promise<void>;
  }
}

/**
 * Declaração estendida para Redis
 */
declare module 'redis' {
  export interface RedisClientOptions {
    db?: number;
  }
}
