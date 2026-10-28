// Exige "Authorization: Bearer <jwt>" válido com role=admin.
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const cabecalho = req.headers.authorization ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ ok: false, reason: 'unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload.role !== 'admin') throw new Error('role inválida');
    next();
  } catch {
    res.status(401).json({ ok: false, reason: 'unauthorized' });
  }
}
