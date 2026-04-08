/**
 * SISTEMA DE LOGGING COM PINO
 *
 * Utiliza serializers padrão do Pino para:
 * - Erros (err: pino.stdSerializers.err)
 * - Requisições e respostas HTTP (via pino-http)
 */

import pino from 'pino';
import config from '../config/env.js';

const logger = pino(
  {
    level: config.logLevel,
    serializers: {
      err: pino.stdSerializers.err,  // Serialização nativa de Error objects
    },
    transport: config.isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
  }
);

export default logger;
