// Controllers exclusivos do painel administrativo: métricas e renovação de keys.
import { Request, Response } from 'express';
import { KeyAdminView } from '../models/Key';
import * as service from '../services/keyService';
import { Resultado } from '../services/keyService';
import { lerKey } from '../utils/validacao';

/** Resposta de erro padrão da API ADMIN: { ok: false, reason }. */
function erroAdmin(res: Response, status: number, reason: string): void {
  res.status(status).json({ ok: false, reason });
}

function responder<T extends object>(res: Response, r: Resultado<T>): void {
  if (r.ok) {
    res.json({ ok: true, ...r.data });
  } else {
    erroAdmin(res, r.status, r.reason);
  }
}

/** GET /api/admin/stats -> { ok, total, pending, active, paused, expired } */
export function stats(_req: Request, res: Response): void {
  res.json({ ok: true, ...service.estatisticas() });
}

/** POST /api/admin/key/extend  { key, duration } */
export function extendKey(req: Request, res: Response): void {
  const key = lerKey(req.body);
  if (!key) return erroAdmin(res, 400, 'bad_request');

  const duracao = (req.body as Record<string, unknown>).duration;
  const r: Resultado<KeyAdminView> = service.estender(key, duracao);
  responder(res, r);
}
