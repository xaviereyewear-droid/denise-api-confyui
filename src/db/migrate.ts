/**
 * MIGRATION SYSTEM
 *
 * Gerencia versionamento e execução de migrações SQLite.
 * Sistema simples mas eficaz para MVP.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import logger from '../lib/logger.js';

interface Migration {
  version: number;
  name: string;
  appliedAt?: string;
}

/**
 * Executar migrações pendentes
 * Lê arquivos .sql em ordem numérica e executa
 */
export function runMigrations(db: Database.Database): void {
  try {
    logger.info('Iniciando sistema de migrações');

    // Criar tabela de tracking se não existir
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ler diretório de migrações
    const migrationsDir = path.join(process.cwd(), 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      logger.warn('Diretório de migrações não encontrado');
      return;
    }

    // Ler arquivos SQL em ordem
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.info('Nenhuma migração encontrada');
      return;
    }

    // Aplicar cada migração
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const version = parseInt(file.split('_')[0], 10);
      const name = file;

      // Verificar se já foi aplicada
      const applied = db.prepare(
        'SELECT version FROM migrations WHERE version = ?'
      ).get(version) as Migration | undefined;

      if (applied) {
        logger.debug({ migration: name }, 'Migração já aplicada');
        continue;
      }

      // Ler e executar SQL
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        // Executar migração
        db.exec(sql);

        // Registrar como aplicada
        db.prepare(
          'INSERT OR IGNORE INTO migrations (version, name) VALUES (?, ?)'
        ).run(version, name);

        logger.info({ migration: name }, '✅ Migração aplicada');
      } catch (error) {
        logger.error(
          { migration: name, error },
          '❌ Erro ao aplicar migração'
        );
        throw new Error(`Migração ${name} falhou: ${error}`);
      }
    }

    logger.info('Todas as migrações aplicadas com sucesso');
  } catch (error) {
    logger.error({ error }, 'Erro no sistema de migrações');
    throw error;
  }
}

/**
 * Listar migrações aplicadas
 */
export function listMigrations(db: Database.Database): Migration[] {
  try {
    const migrations = db.prepare(
      'SELECT version, name, applied_at FROM migrations ORDER BY version'
    ).all() as Migration[];

    return migrations;
  } catch (error) {
    logger.error({ error }, 'Erro ao listar migrações');
    return [];
  }
}

/**
 * Rollback de uma migração (apenas remove do tracking)
 * Não desfaz SQL (usar com cuidado!)
 */
export function rollbackMigration(db: Database.Database, version: number): void {
  try {
    db.prepare('DELETE FROM migrations WHERE version = ?').run(version);
    logger.info({ version }, 'Migração removida do tracking');
  } catch (error) {
    logger.error({ error }, 'Erro ao fazer rollback');
    throw error;
  }
}

export default runMigrations;
