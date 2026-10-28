// Controllers administrativos complementares: métricas e renovação de tempo.
import { Request, Response } from 'express';
import * as service from '../services/keyService';
import { lerKey } from '../utils/validacao';

/** GET /api/admin/stats */
export function stats(_req: Request, res: Response): void {
  res.json({ ok: true, ...service.estatisticas() });
}

/** POST /api/admin/key/extend  { key, duration } */
export function extendKey(req: Request, res: Response): void {
  const key = lerKey(req.body);
  const duracao = (req.body as Record<string, unknown> | undefined)?.duration;
  if (!key) {
    res.status(400).json({ ok: false, reason: 'bad_request' });
    return;
  }
  const r = service.estender(key, duracao);
  if (r.ok) res.json({ ok: true, key: r.data });
  else res.status(r.status).json({ ok: false, reason: r.reason });
}
