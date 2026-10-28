// Regras de negócio das licenças. Toda escrita crítica roda em transação
// "immediate" (lock de escrita imediato) para evitar condições de corrida.
import { db } from '../config/database';
import {
  KeyAdminView,
  KeyRow,
  KeyStatus,
  SQL_STATUS,
  expiracaoReal,
  segundosRestantes,
  toAdminView,
} from '../models/Key';
import { formatarDuracao, parseDuracao } from '../utils/duration';
import { gerarKey } from '../utils/keyGenerator';

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------
export interface Falha { ok: false; status: number; reason: string }
export type Resultado<T> = { ok: true; data: T } | Falha;

const ok = <T>(data: T): Resultado<T> => ({ ok: true, data });
const falha = (status: number, reason: string): Falha => ({ ok: false, status, reason });

export interface RespostaValidacao {
  valid: true;
  key: string;
  duration: string;
  hwid: string | null;
  activated_at: number | null;
  expires_at: number | null;   // null = licença eterna
  seconds_left: number | null; // null = licença eterna
}

export interface RespostaStatus {
  valid: true;
  key: string;
  duration: string;
  expires_at: number | null;
  seconds_left: number | null;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------
function buscar(key: string): KeyRow | undefined {
  return db.prepare('SELECT * FROM keys WHERE key = ?').get(key) as KeyRow | undefined;
}

/** Checagens de pausa e expiração (a de HWID é feita à parte, pois depende do contexto). */
function checarEstado(row: KeyRow, agora: number): Falha | null {
  if (row.is_paused === 1) return falha(403, 'paused');
  const exp = expiracaoReal(row);
  if (exp !== null && agora >= exp) return falha(403, 'expired');
  return null;
}

function montarValidacao(row: KeyRow, agora: number): RespostaValidacao {
  return {
    valid: true,
    key: row.key,
    duration: row.duration,
    hwid: row.hwid,
    activated_at: row.activated_at,
    expires_at: expiracaoReal(row),
    seconds_left: segundosRestantes(row, agora),
  };
}

// ---------------------------------------------------------------------------
// POST /api/public/key/validate  (valida e ATIVA no primeiro uso)
// ---------------------------------------------------------------------------
const txValidar = db.transaction((key: string, hwid: string, agora: number): Resultado<RespostaValidacao> => {
  const row = buscar(key);
  if (!row) return falha(404, 'invalid_key');

  // --- Primeira ativação: o relógio da licença começa agora ---
  if (row.is_active === 0) {
    if (row.is_paused === 1) return falha(403, 'paused');

    const expiraEm = row.duration_seconds === 0 ? null : agora + row.duration_seconds * 1000;
    const r = db
      .prepare(
        `UPDATE keys
            SET hwid = ?, is_active = 1, activated_at = ?, expires_at = ?, updated_at = ?
          WHERE id = ? AND is_active = 0`
      )
      .run(hwid, agora, expiraEm, agora, row.id);
    if (r.changes !== 1) return falha(409, 'conflict'); // defensivo: a transação já serializa

    return ok(montarValidacao({ ...row, hwid, is_active: 1, activated_at: agora, expires_at: expiraEm }, agora));
  }

  // --- Validação recorrente ---
  if (row.hwid === null) {
    // HWID foi resetado pelo admin: o primeiro aparelho válido a chamar assume a key.
    // O tempo NÃO é reiniciado (activated_at / expires_at permanecem).
    const bloqueio = checarEstado(row, agora);
    if (bloqueio) return bloqueio;

    db.prepare('UPDATE keys SET hwid = ?, updated_at = ? WHERE id = ?').run(hwid, agora, row.id);
    return ok(montarValidacao({ ...row, hwid }, agora));
  }

  if (row.hwid !== hwid) return falha(403, 'hwid_mismatch');
  const bloqueio = checarEstado(row, agora);
  if (bloqueio) return bloqueio;

  return ok(montarValidacao(row, agora));
});

export function validar(key: string, hwid: string): Resultado<RespostaValidacao> {
  return txValidar.immediate(key, hwid, Date.now());
}

// ---------------------------------------------------------------------------
// POST /api/public/key/status  (somente leitura / heartbeat; NÃO ativa)
// ---------------------------------------------------------------------------
export function consultarStatus(key: string, hwid: string): Resultado<RespostaStatus> {
  const agora = Date.now();
  const row = buscar(key);
  if (!row) return falha(404, 'invalid_key');
  if (row.is_active === 0) return falha(403, 'not_activated');

  // hwid nulo (resetado) também diverge: o app deve chamar /validate para revincular.
  if (row.hwid !== hwid) return falha(403, 'hwid_mismatch');

  const bloqueio = checarEstado(row, agora);
  if (bloqueio) return bloqueio;

  return ok({
    valid: true,
    key: row.key,
    duration: row.duration,
    expires_at: expiracaoReal(row),
    seconds_left: segundosRestantes(row, agora),
  });
}

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------

/** Limpa o HWID mantendo activated_at/expires_at intactos. */
export function resetarHwid(key: string): Resultado<{ key: string }> {
  const r = db.prepare('UPDATE keys SET hwid = NULL, updated_at = ? WHERE key = ?').run(Date.now(), key);
  return r.changes === 0 ? falha(404, 'invalid_key') : ok({ key });
}

const txPausa = db.transaction((key: string, agora: number): Resultado<{ key: string; is_paused: boolean }> => {
  const row = buscar(key);
  if (!row) return falha(404, 'invalid_key');
  const novo = row.is_paused === 1 ? 0 : 1;
  db.prepare('UPDATE keys SET is_paused = ?, updated_at = ? WHERE id = ?').run(novo, agora, row.id);
  return ok({ key, is_paused: novo === 1 });
});

/** Alterna pausado/despausado. */
export function alternarPausa(key: string) {
  return txPausa.immediate(key, Date.now());
}

export function deletar(key: string): Resultado<{ key: string }> {
  const r = db.prepare('DELETE FROM keys WHERE key = ?').run(key);
  return r.changes === 0 ? falha(404, 'invalid_key') : ok({ key });
}

const MAX_LOTE = 500;

const txGerar = db.transaction((quantidade: number, label: string, segundos: number, agora: number): string[] => {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO keys (key, duration, duration_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const geradas: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    // Colisão é praticamente impossível (36^23), mas o UNIQUE garante; tenta de novo se ocorrer.
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const key = gerarKey();
      if (insert.run(key, label, segundos, agora, agora).changes === 1) {
        geradas.push(key);
        break;
      }
    }
  }
  return geradas;
});

/** Gera um lote de keys PENDENTES (o tempo só conta a partir do primeiro /validate). */
export function gerar(quantidade: unknown, duracao: unknown): Resultado<{ duration: string; keys: string[] }> {
  const d = parseDuracao(duracao);
  const qtd = typeof quantidade === 'number' ? quantidade : Number(quantidade);
  if (!d || !Number.isInteger(qtd) || qtd < 1 || qtd > MAX_LOTE) return falha(400, 'bad_request');

  const keys = txGerar.immediate(qtd, d.label, d.segundos, Date.now());
  return ok({ duration: d.label, keys });
}

const txEstender = db.transaction((key: string, adicionar: number, agora: number): Resultado<KeyAdminView> => {
  const row = buscar(key);
  if (!row) return falha(404, 'invalid_key');
  if (row.duration_seconds === 0) return falha(400, 'already_lifetime');

  let duracaoSeg: number;
  let expiraEm: number | null;

  if (row.is_active === 0) {
    // Ainda pendente: apenas aumenta a duração que começará a contar na ativação.
    duracaoSeg = row.duration_seconds + adicionar;
    expiraEm = null;
  } else {
    // Ativa: soma a partir da expiração atual; se já expirou, renova a partir de agora.
    const base = Math.max(expiracaoReal(row) ?? agora, agora);
    expiraEm = base + adicionar * 1000;
    const inicio = row.activated_at ?? agora;
    duracaoSeg = Math.round((expiraEm - inicio) / 1000); // mantém expires_at = activated_at + duration*1000
  }

  db.prepare('UPDATE keys SET duration = ?, duration_seconds = ?, expires_at = ?, updated_at = ? WHERE id = ?').run(
    formatarDuracao(duracaoSeg),
    duracaoSeg,
    expiraEm,
    agora,
    row.id
  );
  return ok(toAdminView(buscar(key) as KeyRow, agora));
});

/** Renova/estende o tempo de uma key. */
export function estender(key: string, duracao: unknown): Resultado<KeyAdminView> {
  const d = parseDuracao(duracao);
  if (!d || d.segundos === 0) return falha(400, 'bad_request');
  return txEstender.immediate(key, d.segundos, Date.now());
}

// ---------------------------------------------------------------------------
// Listagem e métricas
// ---------------------------------------------------------------------------
export interface FiltroLista {
  status?: KeyStatus;
  busca?: string;
  limite: number;
  deslocamento: number;
}

export function listar(filtro: FiltroLista): { total: number; keys: KeyAdminView[] } {
  const agora = Date.now();
  const condicoes: string[] = [];
  const params: Record<string, string | number> = {};

  if (filtro.status) {
    condicoes.push(`(${SQL_STATUS[filtro.status]})`);
    if (filtro.status === 'expired' || filtro.status === 'active') params.agora = agora;
  }
  if (filtro.busca) {
    // Escapa curingas do LIKE para tratar a busca como texto literal.
    const literal = filtro.busca.replace(/[\\%_]/g, (c) => `\\${c}`);
    condicoes.push(`(key LIKE @busca ESCAPE '\\' OR hwid LIKE @busca ESCAPE '\\')`);
    params.busca = `%${literal}%`;
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const contar = db.prepare(`SELECT COUNT(*) AS n FROM keys ${where}`);
  const total = (Object.keys(params).length ? contar.get(params) : contar.get()) as { n: number };
  const linhas = db
    .prepare(`SELECT * FROM keys ${where} ORDER BY created_at DESC, id DESC LIMIT @limite OFFSET @deslocamento`)
    .all({ ...params, limite: filtro.limite, deslocamento: filtro.deslocamento }) as KeyRow[];

  return { total: total.n, keys: linhas.map((l) => toAdminView(l, agora)) };
}

export function estatisticas() {
  const agora = Date.now();
  const linha = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN ${SQL_STATUS.pending} THEN 1 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN ${SQL_STATUS.active}  THEN 1 END), 0) AS active,
         COALESCE(SUM(CASE WHEN ${SQL_STATUS.paused}  THEN 1 END), 0) AS paused,
         COALESCE(SUM(CASE WHEN ${SQL_STATUS.expired} THEN 1 END), 0) AS expired
       FROM keys`
    )
    .get({ agora }) as { total: number; pending: number; active: number; paused: number; expired: number };
  return linha;
}
