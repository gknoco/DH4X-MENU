// Tipos e helpers do modelo `keys`.

export interface KeyRow {
  id: number;
  key: string;
  duration: string;
  duration_seconds: number; // 0 = lifetime
  hwid: string | null;
  is_active: 0 | 1;
  is_paused: 0 | 1;
  activated_at: number | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export type KeyStatus = 'pending' | 'active' | 'paused' | 'expired';

/** Fragmentos SQL equivalentes a `statusDaKey` (usam o parâmetro nomeado @agora). */
export const SQL_STATUS: Record<KeyStatus, string> = {
  pending: 'is_active = 0 AND is_paused = 0',
  paused: 'is_paused = 1',
  expired:
    'is_paused = 0 AND is_active = 1 AND duration_seconds > 0 AND expires_at IS NOT NULL AND expires_at <= @agora',
  active:
    'is_paused = 0 AND is_active = 1 AND (duration_seconds = 0 OR expires_at IS NULL OR expires_at > @agora)',
};

/**
 * Expiração efetiva da key. Retorna null para licenças eternas (ou ainda não ativadas).
 * Se `expires_at` estiver nulo por inconsistência, recalcula a partir de `activated_at`.
 */
export function expiracaoReal(row: KeyRow): number | null {
  if (row.duration_seconds === 0) return null;
  if (row.expires_at !== null) return row.expires_at;
  if (row.activated_at !== null) return row.activated_at + row.duration_seconds * 1000;
  return null;
}

/** Segundos restantes (arredondado para baixo, nunca negativo). null = eterna. */
export function segundosRestantes(row: KeyRow, agora: number): number | null {
  const exp = expiracaoReal(row);
  return exp === null ? null : Math.max(0, Math.floor((exp - agora) / 1000));
}

export function statusDaKey(row: KeyRow, agora: number): KeyStatus {
  if (row.is_paused === 1) return 'paused';
  if (row.is_active === 0) return 'pending';
  const exp = expiracaoReal(row);
  if (exp !== null && agora >= exp) return 'expired';
  return 'active';
}

/** Visão da key devolvida ao painel admin. */
export interface KeyAdminView {
  id: number;
  key: string;
  duration: string;
  duration_seconds: number;
  hwid: string | null;
  status: KeyStatus;
  is_active: boolean;
  is_paused: boolean;
  activated_at: number | null;
  expires_at: number | null;
  seconds_left: number | null;
  created_at: number;
  updated_at: number;
}

export function toAdminView(row: KeyRow, agora: number): KeyAdminView {
  return {
    id: row.id,
    key: row.key,
    duration: row.duration,
    duration_seconds: row.duration_seconds,
    hwid: row.hwid,
    status: statusDaKey(row, agora),
    is_active: row.is_active === 1,
    is_paused: row.is_paused === 1,
    activated_at: row.activated_at,
    expires_at: expiracaoReal(row),
    seconds_left: row.is_active === 1 ? segundosRestantes(row, agora) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
