// Conexão SQLite (better-sqlite3) e criação automática do schema no startup.
// better-sqlite3 é síncrono: transações "immediate" serializam as escritas,
// o que elimina condições de corrida em ativações simultâneas da mesma key.
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './env';

fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });

export const db = new Database(env.dbPath);

db.pragma('journal_mode = WAL');   // leituras não bloqueiam escritas
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');  // espera até 5s por lock em vez de falhar

/** Cria a tabela `keys` (e índices) caso ainda não existam. */
export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      key              TEXT    NOT NULL UNIQUE,
      duration         TEXT    NOT NULL,
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0), -- 0 = lifetime
      hwid             TEXT,
      is_active        INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
      is_paused        INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
      activated_at     INTEGER,  -- ms (Unix)
      expires_at       INTEGER,  -- ms (Unix); NULL = ainda não ativada ou lifetime
      created_at       INTEGER NOT NULL,
      updated_at       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_keys_created_at ON keys (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_keys_hwid ON keys (hwid);
  `);
}

export function fecharDatabase(): void {
  if (db.open) db.close();
}
