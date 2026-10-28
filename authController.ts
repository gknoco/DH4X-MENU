// Login do administrador (credenciais em ADMIN_USER / ADMIN_PASS) -> JWT.
import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { texto } from '../utils/validacao';

// A senha do .env é convertida em hash uma vez, no startup, e comparada com bcrypt.
const HASH_ADMIN = bcrypt.hashSync(env.adminPass, 12);
const DURACAO_TOKEN_SEG = 60 * 60 * 12; // 12 horas

/** Comparação em tempo constante (hash antes para igualar o tamanho dos buffers). */
function igualSeguro(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** POST /api/admin/login  { user, pass } */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const corpo = (req.body ?? {}) as Record<string, unknown>;
    const user = texto(corpo.user, 128);
    const pass = texto(corpo.pass, 256);
    if (!user || !pass) {
      res.status(400).json({ ok: false, reason: 'bad_request' });
      return;
    }

    // Sempre executa as duas verificações para não vazar qual campo errou (nem por tempo).
    const userOk = igualSeguro(user, env.adminUser);
    const passOk = await bcrypt.compare(pass, HASH_ADMIN);
    if (!userOk || !passOk) {
      res.status(401).json({ ok: false, reason: 'invalid_credentials' });
      return;
    }

    const token = jwt.sign({ sub: env.adminUser, role: 'admin' }, env.jwtSecret, { expiresIn: DURACAO_TOKEN_SEG });
    res.json({ ok: true, token, expires_in: DURACAO_TOKEN_SEG });
  } catch (err) {
    next(err);
  }
}
