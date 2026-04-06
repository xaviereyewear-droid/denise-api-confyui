/**
 * DATABASE CONNECTION & INITIALIZATION
 *
 * Gerencia conexão com SQLite e inicialização do banco.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from '../lib/logger.js';
import config from '../config/env.js';

/**
 * Instância única do database
 * Singletons padrão em Node.js
 */
let dbInstance: Database.Database | null = null;

/**
 * Inicializar banco de dados
 * - Cria arquivo .db se não existir
 * - Executa migrations
 * - Retorna instância do database
 */
export function initializeDatabase(): Database.Database {
  try {
    // Caminho do arquivo do banco
    const dbPath = path.join(config.storagePath, 'api.db');

    logger.info({ dbPath }, 'Inicializando banco de dados SQLite');

    // Criar diretório storage se não existir
    if (!fs.existsSync(config.storagePath)) {
      fs.mkdirSync(config.storagePath, { recursive: true });
      logger.info('Diretório de storage criado');
    }

    // Criar instância do banco
    const db = new Database(dbPath);

    // Configurações de performance
    db.pragma('journal_mode = WAL');  // Write-Ahead Logging para melhor concorrência
    db.pragma('synchronous = NORMAL');  // Balance entre segurança e performance
    db.pragma('cache_size = -64000');  // 64MB cache
    db.pragma('foreign_keys = ON');  // Enforce foreign keys

    logger.info('Banco de dados inicializado com sucesso');

    return db;
  } catch (error) {
    logger.error({ error }, 'Erro ao inicializar banco de dados');
    throw error;
  }
}

/**
 * Obter instância única do database
 * Lazy initialization pattern
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = initializeDatabase();
  }
  return dbInstance;
}

/**
 * Fechar conexão do banco
 * Para graceful shutdown
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      logger.info('Banco de dados fechado');
      dbInstance = null;
    } catch (error) {
      logger.error({ error }, 'Erro ao fechar banco de dados');
    }
  }
}

/**
 * Health check do banco
 * Verifica se conexão está funcional
 */
export function checkDatabaseHealth(): boolean {
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT 1').get();
    return result !== undefined;
  } catch (error) {
    logger.error({ error }, 'Health check do banco falhou');
    return false;
  }
}

/**
 * Obter informações do banco
 */
export function getDatabaseInfo() {
  try {
    const db = getDatabase();

    // Contar tabelas
    const tables = db.prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'`
    ).get() as { count: number };

    // Contar jobs
    const jobs = db.prepare(
      `SELECT COUNT(*) as count FROM jobs`
    ).get() as { count: number };

    // Tamanho do arquivo
    const dbPath = path.join(config.storagePath, 'api.db');
    const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    return {
      tables: tables.count,
      jobs: jobs.count,
      size_mb: (size / 1024 / 1024).toFixed(2),
      path: dbPath,
    };
  } catch (error) {
    logger.error({ error }, 'Erro ao obter info do banco');
    return null;
  }
}

export default getDatabase;
