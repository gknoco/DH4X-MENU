// 404 para rotas /api desconhecidas e tratador global de erros.
import { NextFunction, Request, Response } from 'express';

export function rotaNaoEncontrada(_req: Request, res: Response): void {
  res.status(404).json({ valid: false, reason: 'not_found' });
}

interface ErroHttp extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

// O parâmetro `_next` precisa existir para o Express reconhecer este middleware como tratador de erros.
export function tratarErros(err: ErroHttp, _req: Request, res: Response, _next: NextFunction): void {
  // JSON malformado ou corpo grande demais (erros do body-parser) => requisição inválida.
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err.type === 'charset.unsupported') {
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({ valid: false, reason: 'bad_request' });
    return;
  }

  console.error('[erro]', err);
  res.status(500).json({ valid: false, reason: 'server_error' });
}
