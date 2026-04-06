/**
 * SISTEMA DE LOGGING COM PINO
 */

import pino from 'pino';
import config from '../config/env.js';

const logger = pino(
  {
    level: config.logLevel,
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
