// Controllers das keys: 2 públicos (APK) + 5 administrativos.
import { Request, Response } from 'express';
import * as service from '../services/keyService';
import { Resultado } from '../services/keyService';
import { lerKey, lerKeyEHwid } from '../utils/validacao';
import { KeyStatus } from '../models/Key';

/** Resposta de erro padronizada para a API PÚBLICA: { valid: false, reason }. */
function erroPublico(res: Response, status: number, reason: string): void {
  res.status(status).json({ valid: false, reason });
}

/** Resposta de erro para a API ADMIN: { ok: false, reason }. */
function erroAdmin(res: Response, status: number, reason: string): void {
  res.status(status).json({ ok: false, reason });
}

function responder<T extends object>(res: Response, r: Resultado<T>, publico: boolean): void {
  if (r.ok) {
    res.json(publico ? r.data : { ok: true, ...r.data });
  } else {
    (publico ? erroPublico : erroAdmin)(res, r.status, r.reason);
  }
}

// ----------------------------- PÚBLICO ------------------------------------

/** POST /api/public/key/validate */
export function validateKey(req: Request, res: Response): void {
  const dados = lerKeyEHwid(req.body);
  if (!dados) return erroPublico(res, 400, 'bad_request');
  responder(res, service.validar(dados.key, dados.hwid), true);
}

/** POST /api/public/key/status */
export function statusKey(req: Request, res: Response): void {
  const dados = lerKeyEHwid(req.body);
  if (!dados) return erroPublico(res, 400, 'bad_request');
  responder(res, service.consultarStatus(dados.key, dados.hwid), true);
}

// ----------------------------- ADMIN --------------------------------------

/** POST /api/admin/key/reset-hwid  { key } */
export function resetHwid(req: Request, res: Response): void {
  const key = lerKey(req.body);
  if (!key) return erroAdmin(res, 400, 'bad_request');
  responder(res, service.resetarHwid(key), false);
}

/** POST /api/admin/keys/generate  { quantity, duration } */
export function generateKeys(req: Request, res: Response): void {
  const corpo = (req.body ?? {}) as Record<string, unknown>;
  responder(res, service.gerar(corpo.quantity, corpo.duration), false);
}

/** GET /api/admin/keys?status=&search=&limit=&offset= */
export function listKeys(req: Request, res: Response): void {
  const validos: KeyStatus[] = ['pending', 'active', 'paused', 'expired'];
  const status = validos.find((s) => s === req.query.status);
  const busca = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 128) : '';

  const limite = Math.min(Math.max(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1), 1000);
  const deslocamento = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  const { total, keys } = service.listar({ status, busca: busca || undefined, limite, deslocamento });
  res.json({ ok: true, total, keys });
}

/** POST /api/admin/key/toggle-pause  { key } */
export function togglePauseKey(req: Request, res: Response): void {
  const key = lerKey(req.body);
  if (!key) return erroAdmin(res, 400, 'bad_request');
  responder(res, service.alternarPausa(key), false);
}

/** POST /api/admin/key/delete  { key } */
export function deleteKey(req: Request, res: Response): void {
  const key = lerKey(req.body);
  if (!key) return erroAdmin(res, 400, 'bad_request');
  responder(res, service.deletar(key), false);
}
